#!/bin/bash

# Check if input and output files are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_file.lua> <output_file.json>"
    exit 1
fi

input_file="$1"
output_file="$2"

# Check if input file exists
if [ ! -f "$input_file" ]; then
    echo "Input file not found: $input_file"
    exit 1
fi

# Convert Lua to JSON
lua -e "
function escapeJsonString(str)
    return string.gsub(str, '\"', '\\\\\"')
end

function serialize(o)
    local json = {}
    for k,v in pairs(o) do
        local key = string.format('%q', k)
        if type(v) == 'table' then
            if k == 'Description' then
                local arr = {}
                for _, item in ipairs(v) do
                    table.insert(arr, string.format('%q', escapeJsonString(item)))
                end
                v = '['..table.concat(arr, ',')..']'
            else
                v = serialize(v)
            end
        elseif type(v) == 'string' then
            v = string.format('%q', escapeJsonString(v))
        else
            v = '\"'..tostring(v)..'\"'
        end
        table.insert(json, string.format('%s:%s', key, v))
    end
    return '{' .. table.concat(json, ',') .. '}'
end

dofile('$input_file')
print(serialize(QuestInfoList))
" | sed 's/\\"/"/g; s/,}/}/g; s/^{}//' > "$output_file"

echo "Conversion complete. Output saved to $output_file"
