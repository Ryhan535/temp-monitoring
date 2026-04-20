<?php

$SUPABASE_URL = "https://kuhvnqwucjabrdatiycf.supabase.co/rest/v1/sensor_data";
$SUPABASE_KEY = "sb_publishable_T21IBBwYKQJzR_NKzs6m4g_calRNBij";

$LIMIT = 1000; // maksimal data dihapus per run

//  BATAS 
$cutoff = date("Y-m-d\TH:i:s", strtotime("-7 days"));

// AMBIL ID
$getUrl = $SUPABASE_URL
    . "?select=id"
    . "&timestamp=lt." . urlencode($cutoff)
    . "&limit=" . $LIMIT;

$optionsGet = [
    "http" => [
        "header" => [
            "apikey: $SUPABASE_KEY",
            "Authorization: Bearer $SUPABASE_KEY"
        ]
    ]
];

$response = file_get_contents($getUrl, false, stream_context_create($optionsGet));

if ($response === FALSE) {
    echo "Gagal ambil data\n";
    exit;
}

$data = json_decode($response, true);

if (empty($data)) {
    echo "Tidak ada data lama\n";
    exit;
}

$ids = array_map(fn($row) => $row['id'], $data);
$idList = implode(",", $ids);

// ================= STEP 3: DELETE =================
$deleteUrl = $SUPABASE_URL . "?id=in.(" . $idList . ")";

$optionsDelete = [
    "http" => [
        "header" => [
            "apikey: $SUPABASE_KEY",
            "Authorization: Bearer $SUPABASE_KEY"
        ],
        "method" => "DELETE"
    ]
];

$result = file_get_contents($deleteUrl, false, stream_context_create($optionsDelete));

// ================= OUTPUT =================
echo "Deleted: " . count($ids) . " rows\n";