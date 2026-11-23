"""Compare the workbook's numbered exercises, answer slots and table cells with the bank."""

import argparse
import hashlib
import json
from pathlib import Path
import re

import fitz

from semantic_tables import extract as extract_tables


CHAPTERS = [(2, 5), (3, 50), (4, 96), (5, 170), (6, 188), (7, 263),
            (8, 300), (9, 318), (11, 334), (12, 377), (0, 408)]
SPELLING_STARTS = [207, 216, 223, 226, 231, 235, 240, 244, 249, 254, 259, 263]
ANSWER_LINE = re.compile(r"^\s*ответ\s*:\s*_{3,}", re.I | re.M)
NUMBERED = re.compile(r"^[ \t]*(\d+)\.[ \t]+", re.M)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit(pdf_path, bank_path):
    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    checksum = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    require(checksum == bank["source"]["checksum"], "PDF другой редакции")
    with fitz.open(pdf_path) as document:
        require(len(document) == 545, "Ожидалось 545 физических страниц")
        pages = [page.get_text(sort=True) for page in document]

    primary = [task for task in bank["tasks"] if not task["id"].endswith("-table")]
    tasks_by_id = {task["id"]: task for task in bank["tasks"]}
    for (number, start), (_, end) in zip(CHAPTERS, CHAPTERS[1:]):
        text = "\n".join(pages[start - 1:end - 1])
        require(re.search(rf"ЗАДАНИЕ\s+{number}\.", pages[start - 1]), f"Не найдено начало №{number}")
        actual = [task for task in primary if task["oge"] == number]
        if number == 6:
            source_count = 0
            for group, (first, after) in enumerate(zip(SPELLING_STARTS, SPELLING_STARTS[1:]), 1):
                practice = re.split(r"ЗАДАНИЕ\s*:", "\n".join(pages[first - 1:after - 1]), maxsplit=1)[1]
                printed = [int(value) for value in NUMBERED.findall(practice)]
                require(printed == list(range(1, len(printed) + 1)), f"Нарушена последовательность №6, тема {group}")
                for question in printed:
                    require(f'{bank["packId"]}-oge6-topic{group}-q{question}' in tasks_by_id,
                            f"Пропущено №6, тема {group}, вопрос {question}")
                source_count += len(printed)
        else:
            source_count = len(ANSWER_LINE.findall(text))
        require(source_count == len(actual), f"№{number}: PDF {source_count}, банк {len(actual)}")

        if number == 2:
            labels = re.findall(r"^\s*(?:ТЕКСТ\s+(\d+)\.|ЗАДАНИЕ\s*№\s*(\d+)\.)", text, re.M)
            source_ids = []
            for group, part in labels:
                if group:
                    text_number = group
                else:
                    source_ids.append(f'{bank["packId"]}-oge2-topic1-q{text_number}-part{part}')
            require(sorted(source_ids) == sorted(task["id"] for task in actual), "Адреса №2 различаются")
        if number == 4:
            sections = ANSWER_LINE.split(text)[:-1]
            ordered = sorted(actual, key=lambda task: tuple(map(int, re.search(r"topic(\d+)-q(\d+)$", task["id"]).groups())))
            for source_section, task in zip(sections, ordered):
                positions = NUMBERED.findall(source_section)
                options = positions[len(positions) - 1 - positions[::-1].index("1"):]
                require(options == [option["id"] for option in task["options"]], f'Опции {task["id"]} различаются')
        print(f"№{number}: {source_count}")

    tables = extract_tables(pdf_path)["tables"]
    require(set(tables) == {key for key in tasks_by_id if key.endswith("-table")}, "Адреса таблиц различаются")
    for key, data in tables.items():
        task = tasks_by_id[key]
        cells = next(block["rows"] for block in task["explanation"] if block["type"] == "table")
        require(cells == data["rows"], f"Ячейки {key} различаются")
        require(task["sourceKey"] == data["sourceKey"], f"Ключ {key} различается")
        require(set(data["answerPages"]) <= set(task["source"]["answerPages"]), f"Не указана страница таблицы {key}")
    print(f"{len(primary)} первичных упражнений, {len(tables)} таблиц, {sum(len(t['rows']) for t in tables.values())} строк")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--bank", type=Path, default=Path("public/packs/praktikum-2027.json"))
    arguments = parser.parse_args()
    audit(arguments.pdf, arguments.bank)
