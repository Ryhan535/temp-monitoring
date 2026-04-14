<?php

$SUPABASE_URL = "https://YOUR_PROJECT.supabase.co/rest/v1/sensor_data";
$SUPABASE_KEY = "YOUR_ANON_KEY";

$cutoff = date("Y-m-d H:i:s", strtotime("-7 days"));

$url = $SUPABASE_URL . "?timestamp=lt." . urlencode($cutoff);

$options = [
    "http" => [
        "header" => [
            "apikey: $SUPABASE_KEY",
            "Authorization: Bearer $SUPABASE_KEY"
        ],
        "method" => "DELETE"
    ]
];

$context = stream_context_create($options);

$result = file_get_contents($url, false, $context);

echo "Pruning selesai\n";