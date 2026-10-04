"""Camada de integração com fontes externas (escopo §5, §20, §43).

External API → Connector (client + DTO + mapper) → Validation → Normalization → Persistence.
Nenhuma estrutura externa sai deste pacote: o domínio recebe apenas os tipos do mapper.
"""
