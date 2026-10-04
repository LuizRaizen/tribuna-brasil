import pytest
from django.contrib.admin.models import ADDITION, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.test import Client, RequestFactory

from apps.accounts.models import User
from apps.audit import services
from apps.audit.admin import AuditLogAdmin
from apps.audit.models import AuditAction, AuditLog

pytestmark = pytest.mark.django_db


def test_record_strips_sensitive_metadata_keys(rf: RequestFactory) -> None:
    request = rf.get("/", HTTP_USER_AGENT="Teste/1.0", REMOTE_ADDR="192.0.2.10")
    entry = services.record(
        AuditAction.LOGIN,
        request=request,
        actor=None,
        metadata={"password": "x", "reset_token": "y", "csrf": "z", "origin": "web"},
    )
    assert entry.metadata == {"origin": "web"}
    assert entry.user_agent == "Teste/1.0"
    assert entry.ip_hash and "192.0.2.10" not in entry.ip_hash


def test_admin_actions_are_mirrored_into_audit_log() -> None:
    admin_user = User.objects.create_superuser("admin@example.com", "Senha-admin-forte-1")
    LogEntry.objects.create(
        user=admin_user,
        content_type=ContentType.objects.get_for_model(User),
        object_id=str(admin_user.pk),
        object_repr=str(admin_user),
        action_flag=ADDITION,
    )
    event = AuditLog.objects.get(action=AuditAction.ADMIN_CHANGE)
    assert event.actor == admin_user
    assert event.metadata["operation"] == "add"


def test_audit_log_is_read_only_in_admin(rf: RequestFactory) -> None:
    from django.contrib.admin.sites import site

    model_admin = AuditLogAdmin(AuditLog, site)
    request = rf.get("/")
    assert not model_admin.has_add_permission(request)
    assert not model_admin.has_change_permission(request)
    assert not model_admin.has_delete_permission(request)


def test_admin_requires_staff_login() -> None:
    response = Client().get("/admin/")
    assert response.status_code == 302
    assert "/admin/login/" in response["Location"]
