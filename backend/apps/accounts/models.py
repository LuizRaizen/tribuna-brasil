from typing import Any, ClassVar

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class EmailUserManager(UserManager["User"]):
    """Gerenciador para usuários identificados por e-mail (sem username)."""

    use_in_migrations = True

    def _create_user_by_email(self, email: str, password: str | None, **extra: Any) -> "User":
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(  # type: ignore[override]
        self, email: str, password: str | None = None, **extra: Any
    ) -> "User":
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user_by_email(email, password, **extra)

    def create_superuser(  # type: ignore[override]
        self, email: str, password: str | None = None, **extra: Any
    ) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if not extra["is_staff"] or not extra["is_superuser"]:
            raise ValueError("Superusuário precisa de is_staff e is_superuser.")
        return self._create_user_by_email(email, password, **extra)


class User(AbstractUser):
    username = None  # type: ignore[assignment]
    email = models.EmailField("e-mail", unique=True)
    display_name = models.CharField("nome de exibição", max_length=80, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects: ClassVar[EmailUserManager] = EmailUserManager()

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def __str__(self) -> str:
        return self.email
