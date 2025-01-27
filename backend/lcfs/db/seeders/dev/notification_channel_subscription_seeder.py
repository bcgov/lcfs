import structlog
from sqlalchemy import select
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.db.models.notification.NotificationType import NotificationType
from lcfs.db.models.notification.NotificationChannel import NotificationChannel
from lcfs.db.models.notification.NotificationChannelSubscription import (
    NotificationChannelSubscription,
)

logger = structlog.get_logger(__name__)


async def seed_notification_channel_subscriptions(session):
    """
    Seeds NotificationChannelSubscription records for every user based on their roles,
    for all channels that are 'enabled' and 'subscribe_by_default'.

    Steps:
        1. Get all channels that are (enabled=True, subscribe_by_default=True).
        2. For each user, find their roles.
        3. For each role, find the NotificationTypes pointing to that role.
        4. For each NotificationType + channel, insert a subscription if missing.
    """

    logger.info("Seeding NotificationChannelSubscription...")

    # 1. Fetch all channels that are enabled & subscribe_by_default
    channels_query = select(NotificationChannel).where(
        NotificationChannel.enabled == True,
        NotificationChannel.subscribe_by_default == True,
    )
    channels = (await session.execute(channels_query)).scalars().all()
    if not channels:
        logger.info("No enabled + subscribe_by_default channels found; skipping.")
        return

    # Convert to a list of IDs for convenience
    channel_ids = [ch.notification_channel_id for ch in channels]

    # 2. Fetch all user profiles
    users_query = select(UserProfile).order_by(UserProfile.user_profile_id)
    users = (await session.execute(users_query)).scalars().all()
    if not users:
        logger.info("No users found; skipping NotificationChannelSubscription seeding.")
        return

    # For logging summary
    total_inserts = 0

    for user in users:
        # 3. For the user's roles, find matching NotificationTypes
        user_roles_query = select(UserRole).where(
            UserRole.user_profile_id == user.user_profile_id
        )
        user_role_objs = (await session.execute(user_roles_query)).scalars().all()
        if not user_role_objs:
            continue  # user has no roles => skip

        for user_role_obj in user_role_objs:
            # Find the NotificationTypes referencing user_role_obj.role_id
            notif_types_query = select(NotificationType).where(
                NotificationType.role_id == user_role_obj.role_id
            )
            matching_types = (await session.execute(notif_types_query)).scalars().all()
            if not matching_types:
                continue

            # 4. For each NotificationType + each channel -> insert subscription if missing
            for nt in matching_types:
                for ch_id in channel_ids:
                    exists_query = select(NotificationChannelSubscription).where(
                        NotificationChannelSubscription.user_profile_id
                        == user.user_profile_id,
                        NotificationChannelSubscription.notification_type_id
                        == nt.notification_type_id,
                        NotificationChannelSubscription.notification_channel_id
                        == ch_id,
                    )
                    existing_sub = (
                        await session.execute(exists_query)
                    ).scalar_one_or_none()
                    if not existing_sub:
                        # Insert a new subscription
                        new_sub = NotificationChannelSubscription(
                            user_profile_id=user.user_profile_id,
                            notification_type_id=nt.notification_type_id,
                            notification_channel_id=ch_id,
                            is_enabled=True,
                        )
                        session.add(new_sub)
                        total_inserts += 1

    await session.flush()
    logger.info(
        "Seeding NotificationChannelSubscription complete.",
        total_inserted=total_inserts,
    )
