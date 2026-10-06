import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace
from fastapi import HTTPException

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import (
    AudienceScopeEnum,
    CommentVisibilityEnum,
    EntityTypeEnum,
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
    MentionableUserSchema,
)
from lcfs.web.api.internal_comment.services import (
    InternalCommentService,
    _build_entity_link_path,
    _extract_mentioned_user_ids,
    _remove_mention_markup,
    _rewrite_mention_names,
    _strip_mention_names_for_storage,
)


def test_extract_mentioned_user_ids_dedupes_and_preserves_order():
    html = (
        '<p>cc <span class="mention" data-mention-id="5">@Jane Doe</span> and '
        '<span class="mention" data-mention-id="2">@Sam Lee</span> and '
        '<span class="mention" data-mention-id="5">@Jane Doe</span> again</p>'
    )
    assert _extract_mentioned_user_ids(html) == [5, 2]


def test_extract_mentioned_user_ids_empty_for_no_markup():
    assert _extract_mentioned_user_ids("<p>no mentions here</p>") == []
    assert _extract_mentioned_user_ids(None) == []


@pytest.mark.parametrize(
    "entity_type,entity_id,year,expected",
    [
        (EntityTypeEnum.COMPLIANCE_REPORT, 55, 2024, "/compliance-reporting/2024/55"),
        (EntityTypeEnum.TRANSFER, 10, None, "/transfers/10"),
        (EntityTypeEnum.INITIATIVE_AGREEMENT, 11, None, "/initiative-agreement/11"),
        (EntityTypeEnum.DESIGNATED_ACTION, 12, None, "/initiative-agreement/12"),
        (EntityTypeEnum.ADMIN_ADJUSTMENT, 13, None, "/admin-adjustment/13"),
        (EntityTypeEnum.CI_APPLICATION, 14, None, "/ci-applications/14"),
        (EntityTypeEnum.ORGANIZATION, 15, None, "/organizations/15/comment-log"),
    ],
)
def test_build_entity_link_path(entity_type, entity_id, year, expected):
    assert _build_entity_link_path(entity_type, entity_id, year) == expected


# How a comment with one mention is persisted: user id only, no name.
STORED_MENTION_HTML = (
    '<p>Heads up <span class="mention" data-mention-id="5" '
    'contenteditable="false">@</span></p>'
)
JANE = SimpleNamespace(
    user_profile_id=5,
    first_name="Jane",
    last_name="Doe",
    email="jane.doe@gov.bc.ca",
    keycloak_email="jane.doe@gov.bc.ca",
    keycloak_username="janedoe",
)


def _mention_service(requester_id=99):
    mock_repo = MagicMock()
    mock_repo.get_entity_org_and_year = AsyncMock(return_value=(7, None))
    mock_repo.get_category_id_by_name = AsyncMock(return_value=None)
    mock_repo.create_internal_comment = AsyncMock()
    mock_repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment=STORED_MENTION_HTML,
        organization_id=7,
        compliance_year=None,
        audience_scope=AudienceScopeEnum.ANALYST,
        visibility=CommentVisibilityEnum.INTERNAL,
        create_user="GOVUSER",
        create_date=None,
        update_date=None,
        update_user=None,
        update_full_name=None,
        full_name="Gov User",
        documents=[],
    )
    mock_repo.get_active_idir_users_by_ids = AsyncMock(return_value=[JANE])
    mock_repo.get_users_by_ids = AsyncMock(return_value=[JANE])

    mock_notification_service = MagicMock()
    mock_notification_service.send_notification = AsyncMock()
    mock_notification_service.send_mention_notification = AsyncMock()

    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.ANALYST, RoleEnum.GOVERNMENT],
                keycloak_username="GOVUSER",
                first_name="Gov",
                last_name="User",
                user_profile_id=requester_id,
            )
        ),
        repo=mock_repo,
        notification_service=mock_notification_service,
    )
    return service, mock_repo, mock_notification_service


@pytest.mark.anyio
async def test_create_internal_comment_strips_mention_name_before_storing():
    service, mock_repo, _ = _mention_service()

    await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.TRANSFER,
            entity_id=123,
            comment=(
                "<p>Heads up "
                '<span class="mention" data-mention-id="5" '
                'data-mention-name="Jane Doe">@Jane Doe</span></p>'
            ),
            visibility=CommentVisibilityEnum.INTERNAL,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )

    stored_comment = mock_repo.create_internal_comment.call_args.args[0]
    assert 'data-mention-id="5"' in stored_comment.comment
    assert "data-mention-name" not in stored_comment.comment
    assert "Jane Doe" not in stored_comment.comment


@pytest.mark.anyio
async def test_create_internal_comment_notifies_mentioned_idir_user():
    service, mock_repo, mock_notification_service = _mention_service()

    await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.TRANSFER,
            entity_id=123,
            comment='<p>Heads up <span data-mention-id="5">@Jane Doe</span></p>',
            visibility=CommentVisibilityEnum.INTERNAL,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )

    mock_repo.get_active_idir_users_by_ids.assert_awaited_once_with([5])
    mock_notification_service.send_mention_notification.assert_awaited_once()
    kwargs = mock_notification_service.send_mention_notification.await_args.kwargs
    assert kwargs["recipient_user_profile_id"] == 5
    assert kwargs["recipient_email"] == "jane.doe@gov.bc.ca"
    assert kwargs["notification_data"].related_transaction_id == "123"
    assert "/transfers/123" in kwargs["email_context"]["link_path"]
    # The email shows the mentioned name even though storage keeps only the id.
    assert kwargs["email_context"]["comment_text"] == "Heads up @Jane Doe"


@pytest.mark.anyio
async def test_create_internal_comment_does_not_notify_self_mention():
    # The requester mentions themselves (user_profile_id=5) — no notification.
    service, mock_repo, mock_notification_service = _mention_service(requester_id=5)

    await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.TRANSFER,
            entity_id=123,
            comment='<p>Heads up <span data-mention-id="5">@Jane Doe</span></p>',
            visibility=CommentVisibilityEnum.INTERNAL,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )

    mock_repo.get_active_idir_users_by_ids.assert_not_called()
    mock_notification_service.send_mention_notification.assert_not_awaited()


@pytest.mark.anyio
async def test_create_internal_comment_bceid_comment_never_sends_mentions():
    mock_repo = MagicMock()
    mock_repo.get_entity_org_and_year = AsyncMock(return_value=(7, None))
    mock_repo.get_category_id_by_name = AsyncMock(return_value=None)
    mock_repo.create_internal_comment = AsyncMock()
    mock_repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment='<p>cc <span data-mention-id="5">@Jane Doe</span></p>',
        organization_id=7,
        compliance_year=None,
        audience_scope=None,
        visibility=CommentVisibilityEnum.PUBLIC,
        create_user="BCEIDUSER",
        create_date=None,
        update_date=None,
        update_user=None,
        update_full_name=None,
        full_name="BCeID User",
        documents=[],
    )
    mock_repo.get_active_idir_users_by_ids = AsyncMock(return_value=[])
    mock_notification_service = MagicMock()
    mock_notification_service.send_notification = AsyncMock()
    mock_notification_service.send_mention_notification = AsyncMock()

    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.SUPPLIER],
                keycloak_username="BCEIDUSER",
                user_profile_id=12,
                organization_id=7,
            )
        ),
        repo=mock_repo,
        notification_service=mock_notification_service,
    )

    await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.CI_APPLICATION,
            entity_id=123,
            comment='<p>cc <span data-mention-id="5">@Jane Doe</span></p>',
            visibility=CommentVisibilityEnum.PUBLIC,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )

    mock_repo.get_active_idir_users_by_ids.assert_not_called()
    mock_notification_service.send_mention_notification.assert_not_awaited()


@pytest.mark.anyio
async def test_get_mentionable_users_forbidden_for_non_government():
    service = InternalCommentService(
        request=SimpleNamespace(user=SimpleNamespace(role_names=[RoleEnum.SUPPLIER])),
        repo=MagicMock(),
        notification_service=MagicMock(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.get_mentionable_users("jane")

    assert exc_info.value.status_code == 403


@pytest.mark.anyio
async def test_get_mentionable_users_returns_matches_for_government():
    mock_repo = MagicMock()
    mock_repo.search_mentionable_users = AsyncMock(
        return_value=[
            SimpleNamespace(
                user_profile_id=5,
                first_name="Jane",
                last_name="Doe",
                email="jane.doe@gov.bc.ca",
            )
        ]
    )
    service = InternalCommentService(
        request=SimpleNamespace(user=SimpleNamespace(role_names=[RoleEnum.GOVERNMENT])),
        repo=mock_repo,
        notification_service=MagicMock(),
    )

    results = await service.get_mentionable_users("jane")

    mock_repo.search_mentionable_users.assert_awaited_once_with("jane")
    assert len(results) == 1
    assert results[0].user_profile_id == 5
    assert results[0].display_name == "Jane Doe"


def test_rewrite_mention_names_uses_current_name():
    html = (
        '<p>cc <span class="mention" data-mention-id="5" '
        'data-mention-name="Jane Smith">@Jane Smith</span></p>'
    )
    result = _rewrite_mention_names(html, {5: "Jane Doe"})
    assert 'data-mention-name="Jane Doe"' in result
    assert ">@Jane Doe<" in result
    assert "Jane Smith" not in result


def test_rewrite_mention_names_leaves_unknown_user_untouched():
    html = '<span class="mention" data-mention-id="5">@Old Name</span>'
    assert _rewrite_mention_names(html, {}) == html
    assert _rewrite_mention_names(html, {99: "Someone Else"}) == html


def test_rewrite_mention_names_adds_attribute_when_stripped_for_storage():
    # Stored mentions have no `data-mention-name`; it is added back on read.
    html = '<span class="mention" data-mention-id="5">@</span>'
    result = _rewrite_mention_names(html, {5: "Jane Doe"})
    assert result == (
        '<span class="mention" data-mention-id="5" '
        'data-mention-name="Jane Doe">@Jane Doe</span>'
    )


def test_rewrite_mention_names_handles_quills_nested_embed_markup():
    # Real Quill output: inner span plus zero-width guard characters.
    html = (
        '<p>Hi <span class="mention" data-mention-id="18" '
        'contenteditable="false">\ufeff<span contenteditable="false">'
        "@Al Ring</span>\ufeff</span> how are you?</p>"
    )
    result = _rewrite_mention_names(html, {18: "Alasdair Ring"})
    assert result == (
        '<p>Hi <span class="mention" data-mention-id="18" '
        'contenteditable="false" data-mention-name="Alasdair Ring">'
        "@Alasdair Ring</span> how are you?</p>"
    )


def test_strip_mention_names_for_storage_handles_quills_nested_embed_markup():
    html = (
        '<p>Hi <span class="mention" data-mention-id="18" '
        'data-mention-name="Al Ring" contenteditable="false">\ufeff'
        '<span contenteditable="false">@Al Ring</span>\ufeff</span> '
        "how are you?</p>"
    )
    result = _strip_mention_names_for_storage(html)
    assert result == (
        '<p>Hi <span class="mention" data-mention-id="18" '
        'contenteditable="false">@</span> how are you?</p>'
    )


def test_strip_mention_names_for_storage_exact_reported_db_value():
    # Literal content previously found already persisted in the DB — the
    # whole point of this feature is this never gets this far intact.
    html = (
        '<p>Hi <span class="mention" data-mention-id="2" '
        'data-mention-name="Hamed Bayeki" contenteditable="false">\ufeff'
        '<span contenteditable="false">@Hamed Bayeki</span>\ufeff</span> </p>'
    )
    result = _strip_mention_names_for_storage(html)
    assert result == (
        '<p>Hi <span class="mention" data-mention-id="2" '
        'contenteditable="false">@</span> </p>'
    )


def test_strip_mention_names_for_storage_removes_name():
    html = (
        '<p>cc <span class="mention" data-mention-id="5" '
        'data-mention-name="Jane Doe">@Jane Doe</span></p>'
    )
    result = _strip_mention_names_for_storage(html)
    assert 'data-mention-id="5"' in result
    assert "data-mention-name" not in result
    assert "Jane Doe" not in result
    assert '<span class="mention" data-mention-id="5">@</span>' in result


def test_strip_mention_names_for_storage_noop_without_mentions():
    html = "<p>no mentions here</p>"
    assert _strip_mention_names_for_storage(html) == html
    assert _strip_mention_names_for_storage(None) is None


def test_remove_mention_markup_converts_to_plain_text():
    html = (
        '<p>cc <span class="mention" data-mention-id="5" '
        'data-mention-name="Jane Doe">@Jane Doe</span></p>'
    )
    result = _remove_mention_markup(html, {5: "Jane Doe"})
    assert result == "<p>cc @Jane Doe</p>"
    assert "data-mention-id" not in result
    assert "<span" not in result


def test_remove_mention_markup_falls_back_when_name_unresolved():
    html = '<span class="mention" data-mention-id="5">@</span>'
    assert _remove_mention_markup(html, {}) == "@user"


@pytest.mark.anyio
async def test_create_public_comment_strips_mentions_entirely_and_does_not_notify():
    service, mock_repo, mock_notification_service = _mention_service()
    mock_repo.get_entity_org_and_year = AsyncMock(return_value=(7, None))
    mock_repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment="placeholder",
        organization_id=7,
        compliance_year=None,
        audience_scope=None,
        visibility=CommentVisibilityEnum.PUBLIC,
        create_user="GOVUSER",
        create_date=None,
        update_date=None,
        update_user=None,
        update_full_name=None,
        full_name="Gov User",
        documents=[],
    )
    mock_repo.get_users_by_ids = AsyncMock(
        return_value=[
            SimpleNamespace(
                user_profile_id=5,
                first_name="Jane",
                last_name="Doe",
                keycloak_username="janedoe",
            )
        ]
    )

    await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.CI_APPLICATION,
            entity_id=123,
            comment=(
                '<p>cc <span class="mention" data-mention-id="5" '
                'data-mention-name="Jane Doe">@Jane Doe</span></p>'
            ),
            visibility=CommentVisibilityEnum.PUBLIC,
        )
    )

    stored_comment = mock_repo.create_internal_comment.call_args.args[0]
    assert stored_comment.comment == "<p>cc @Jane Doe</p>"
    mock_repo.get_active_idir_users_by_ids.assert_not_called()
    mock_notification_service.send_mention_notification.assert_not_awaited()


@pytest.mark.anyio
async def test_update_comment_to_public_strips_existing_mentions_even_without_text_edit():
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_by_id = AsyncMock(
        return_value=SimpleNamespace(
            internal_comment_id=1,
            comment=(
                '<p>Hi <span class="mention" data-mention-id="5" '
                'contenteditable="false">@</span></p>'
            ),
            visibility=CommentVisibilityEnum.INTERNAL,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )
    mock_repo.is_organization_comment = AsyncMock(return_value=False)
    mock_repo.get_category_id_by_name = AsyncMock(return_value=None)
    mock_repo.get_users_by_ids = AsyncMock(
        return_value=[
            SimpleNamespace(
                user_profile_id=5,
                first_name="Jane",
                last_name="Doe",
                keycloak_username="janedoe",
            )
        ]
    )
    mock_repo.update_internal_comment = AsyncMock(
        return_value=SimpleNamespace(
            internal_comment_id=1,
            comment="placeholder",
            audience_scope=None,
            visibility=CommentVisibilityEnum.PUBLIC,
            create_user="GOVUSER",
            create_date=None,
            update_date=None,
            update_user="GOVUSER",
            update_full_name=None,
            full_name="Gov User",
            documents=[],
        )
    )

    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.GOVERNMENT], keycloak_username="GOVUSER"
            )
        ),
        repo=mock_repo,
        notification_service=MagicMock(),
    )

    # Only the visibility is changing — no `comment` text in the payload.
    await service.update_internal_comment(
        1, InternalCommentUpdateSchema(visibility=CommentVisibilityEnum.PUBLIC)
    )

    stored_text = mock_repo.update_internal_comment.call_args.kwargs["new_comment_text"]
    assert stored_text == "<p>Hi @Jane Doe</p>"
    assert "data-mention-id" not in stored_text


@pytest.mark.anyio
async def test_get_internal_comments_reflects_current_mention_name():
    mock_repo = MagicMock()
    mock_repo.get_internal_comments = AsyncMock(
        return_value=[
            SimpleNamespace(
                internal_comment_id=1,
                comment=(
                    '<p>cc <span class="mention" data-mention-id="5" '
                    'data-mention-name="Old Name">@Old Name</span></p>'
                ),
                audience_scope=AudienceScopeEnum.ANALYST,
                visibility=CommentVisibilityEnum.INTERNAL,
                create_user="GOVUSER",
                create_date=None,
                update_date=None,
                update_user=None,
                update_full_name=None,
                full_name="Gov User",
                documents=[],
            )
        ]
    )
    mock_repo.get_users_by_ids = AsyncMock(
        return_value=[
            SimpleNamespace(
                user_profile_id=5,
                first_name="New",
                last_name="Name",
                keycloak_username="newname",
            )
        ]
    )

    service = InternalCommentService(
        request=SimpleNamespace(user=SimpleNamespace(role_names=[RoleEnum.GOVERNMENT])),
        repo=mock_repo,
        notification_service=MagicMock(),
    )

    results = await service.get_internal_comments(EntityTypeEnum.TRANSFER.value, 123)

    mock_repo.get_users_by_ids.assert_awaited_once_with([5])
    assert "@New Name" in results[0].comment
    assert "Old Name" not in results[0].comment


def test_rewrite_mention_names_escapes_html_in_names():
    html = '<span class="mention" data-mention-id="5">@</span>'
    result = _rewrite_mention_names(html, {5: '<img src=x onerror="y">'})
    assert "<img" not in result
    assert "&lt;img" in result


def test_remove_mention_markup_escapes_html_in_names():
    html = '<span class="mention" data-mention-id="5">@</span>'
    assert "<b>" not in _remove_mention_markup(html, {5: "<b>Jane</b>"})


def _edit_service(existing_html, entity=(EntityTypeEnum.TRANSFER, 123)):
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_by_id = AsyncMock(
        return_value=SimpleNamespace(
            internal_comment_id=1,
            comment=existing_html,
            visibility=CommentVisibilityEnum.INTERNAL,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )
    mock_repo.is_organization_comment = AsyncMock(return_value=False)
    mock_repo.get_category_id_by_name = AsyncMock(return_value=None)
    mock_repo.get_comment_entity = AsyncMock(return_value=entity)
    mock_repo.get_users_by_ids = AsyncMock(return_value=[JANE])
    mock_repo.get_active_idir_users_by_ids = AsyncMock(return_value=[JANE])
    mock_repo.update_internal_comment = AsyncMock(
        return_value=SimpleNamespace(
            internal_comment_id=1,
            comment=existing_html,
            audience_scope=AudienceScopeEnum.ANALYST,
            visibility=CommentVisibilityEnum.INTERNAL,
            organization_id=7,
            compliance_year=None,
            create_user="GOVUSER",
            create_date=None,
            update_date=None,
            update_user="GOVUSER",
            update_full_name=None,
            full_name="Gov User",
            documents=[],
        )
    )
    notification_service = MagicMock()
    notification_service.send_mention_notification = AsyncMock()
    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.ANALYST, RoleEnum.GOVERNMENT],
                keycloak_username="GOVUSER",
                user_profile_id=99,
            )
        ),
        repo=mock_repo,
        notification_service=notification_service,
    )
    return service, mock_repo, notification_service


def _mention(user_id):
    return (
        f'<span class="mention" data-mention-id="{user_id}" '
        f'contenteditable="false">@</span>'
    )


@pytest.mark.anyio
async def test_edit_notifies_only_newly_mentioned_users():
    service, mock_repo, notification_service = _edit_service(f"<p>{_mention(5)}</p>")

    await service.update_internal_comment(
        1,
        InternalCommentUpdateSchema(comment=f"<p>{_mention(5)} and {_mention(6)}</p>"),
    )

    mock_repo.get_active_idir_users_by_ids.assert_awaited_once_with([6])
    notification_service.send_mention_notification.assert_awaited_once()


@pytest.mark.anyio
async def test_edit_without_new_mentions_does_not_notify():
    service, mock_repo, notification_service = _edit_service(f"<p>{_mention(5)}</p>")

    await service.update_internal_comment(
        1, InternalCommentUpdateSchema(comment=f"<p>{_mention(5)} edited</p>")
    )

    mock_repo.get_comment_entity.assert_not_awaited()
    notification_service.send_mention_notification.assert_not_awaited()


@pytest.mark.anyio
async def test_edit_to_public_never_notifies():
    service, _, notification_service = _edit_service("<p>hello</p>")

    await service.update_internal_comment(
        1,
        InternalCommentUpdateSchema(
            comment=f"<p>{_mention(5)}</p>",
            visibility=CommentVisibilityEnum.PUBLIC,
        ),
    )

    notification_service.send_mention_notification.assert_not_awaited()


@pytest.mark.anyio
async def test_mentionable_users_endpoint_returns_matches_for_government(
    client, fastapi_app, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    users = [
        MentionableUserSchema(
            user_profile_id=5, first_name="Jane", last_name="Doe", email="j@gov.bc.ca"
        )
    ]

    with patch(
        "lcfs.web.api.internal_comment.views.InternalCommentService.get_mentionable_users",
        new_callable=AsyncMock,
        return_value=users,
    ) as mock_search:
        response = await client.get(
            fastapi_app.url_path_for("get_mentionable_users"), params={"q": "jan"}
        )

    assert response.status_code == 200
    assert response.json()[0]["displayName"] == "Jane Doe"
    mock_search.assert_awaited_once_with("jan")


@pytest.mark.anyio
async def test_mentionable_users_endpoint_forbidden_for_supplier(
    client, fastapi_app, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    response = await client.get(fastapi_app.url_path_for("get_mentionable_users"))

    assert response.status_code == 403
