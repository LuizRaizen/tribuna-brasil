from allauth.account.adapter import DefaultAccountAdapter
from django.http import HttpRequest

from apps.core.net import client_ip


class AccountAdapter(DefaultAccountAdapter):
    def get_client_ip(self, request: HttpRequest) -> str:
        # Mesma regra de proxies confiáveis usada no restante do sistema, para que o
        # rate limit por IP não possa ser burlado com um X-Forwarded-For forjado.
        return client_ip(request)
