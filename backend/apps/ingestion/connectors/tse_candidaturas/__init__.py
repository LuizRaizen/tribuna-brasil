"""Conector do Portal de Dados Abertos do TSE: candidaturas, informações complementares e bens.

Formato validado contra os arquivos publicados em 11/10/2026 (Eleições Gerais 2026): zips com um CSV
por UF e um consolidado `*_BRASIL.csv`, codificação Latin-1, separador `;`. Quem disputa o 2º turno
aparece em duas linhas (uma por turno, com códigos de eleição distintos).
"""
