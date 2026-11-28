"""Portal uses the existing #5499 lifecycle and association without parallel tables."""

from lcfs.db.models.initiative_agreement.DaEocSubmission import (
    DaEocSubmission,
    DaEocSubmissionHistory,
    da_eoc_submission_document_association,
)


def test_existing_eoc_model_supports_multiple_submissions_and_three_fields():
    assert DaEocSubmission.__table__.schema is None
    assert DaEocSubmissionHistory.__table__.schema is None
    assert {
        "evidence_responses",
        "summary_of_work_completed",
        "how_evidence_meets_agreement_requirements",
        "exceptions_limitations_and_context",
    } <= set(DaEocSubmission.__table__.columns.keys())
    assert set(da_eoc_submission_document_association.c.keys()) == {
        "da_eoc_submission_id",
        "document_id",
    }
    assert not DaEocSubmission.__table__.c.designated_action_id.unique
