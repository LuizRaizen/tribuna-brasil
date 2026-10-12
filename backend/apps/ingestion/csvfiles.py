"""Leitura em fluxo de CSVs grandes (soltos ou dentro de um zip), sem montar um dict por linha."""

import csv
import io
import zipfile
from collections.abc import Iterator
from pathlib import Path

from apps.ingestion.connectors.tse_candidaturas.rows import FileRejected


class Row:
    """Linha acessada pelo nome da coluna; bem mais rápida que csv.DictReader."""

    __slots__ = ("_index", "_values")

    def __init__(self, index: dict[str, int], values: list[str]) -> None:
        self._index = index
        self._values = values

    def __getitem__(self, column: str) -> str:
        i = self._index[column]
        return self._values[i] if i < len(self._values) else ""

    def get(self, column: str, default: str = "") -> str:
        return self[column] if column in self._index else default


def _read(text: io.TextIOBase, name: str, required: set[str], delimiter: str) -> Iterator[Row]:
    reader = csv.reader(text, delimiter=delimiter)
    header = [h.strip().lstrip("﻿") for h in next(reader, [])]
    missing = required - set(header)
    if missing:
        raise FileRejected(f"Colunas ausentes em {name}: {sorted(missing)}")
    index = {column: i for i, column in enumerate(header)}
    for values in reader:
        yield Row(index, values)


def iter_csv(
    path: Path, *, required: set[str], encoding: str = "utf-8-sig", delimiter: str = ";"
) -> Iterator[Row]:
    with path.open(encoding=encoding, newline="") as fh:
        yield from _read(fh, path.name, required, delimiter)


def iter_zip_member(
    archive: zipfile.ZipFile,
    name: str,
    *,
    required: set[str],
    encoding: str = "latin-1",
    delimiter: str = ";",
) -> Iterator[Row]:
    if name not in archive.namelist():
        raise FileRejected(f"CSV '{name}' ausente no zip")
    with archive.open(name) as raw:
        yield from _read(
            io.TextIOWrapper(raw, encoding=encoding, newline=""), name, required, delimiter
        )
