#!/usr/bin/bash

SRC=(
  "000001"
  "000010"
  "000100"
  "001000"
  "010000"
  "100000"
)

for i in ${SRC[@]};
do
    barcode -b "A${i}A" -e "codabar" -c -S -o ${i}.svg
done

