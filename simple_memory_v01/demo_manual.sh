#!/usr/bin/env bash
# Manual demo flow — each CLI call is a fresh OS process.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PYTHONPATH="$ROOT"
DB="${SIMPLE_MEMORY_DB:-$ROOT/simple_memory_v01/data/demo.sqlite3}"
rm -f "$DB"
CLI=(python3 -m simple_memory_v01.cli --db "$DB")

echo "== init =="
"${CLI[@]}" init

echo "== SESSION A: remember =="
"${CLI[@]}" remember --type bio --session A --text "Я родился в городе N. В детстве интересовался X. Позже начал заниматься Y."
"${CLI[@]}" remember --type thought --session A --text "Мне кажется, что хорошая цифровая память должна возвращать не весь архив, а только то, что относится к текущему вопросу."
"${CLI[@]}" remember --type work_state --session A --text "Я работаю над Project X. Сейчас остановился после шага Y. Мы решили использовать Z. Следующий шаг — Q."

echo "== SESSION B: fresh process recall =="
"${CLI[@]}" recall "Что я рассказывал о своей биографии?"
echo
"${CLI[@]}" recall "О чём я говорил в своих мыслях о памяти?"
echo
"${CLI[@]}" recall "Чем я занимался?"
echo
"${CLI[@]}" latest-work
echo
"${CLI[@]}" recall "Что я говорил о выращивании орхидей?"
echo "DB=$DB"
