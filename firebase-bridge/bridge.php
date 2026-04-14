<?php

$RTDB_URL = "https://data-center-40843-default-rtdb.asia-southeast1.firebasedatabase.app/latest.json";

$SUPABASE_URL = "https://kuhvnqwucjabrdatiycf.supabase.co/rest/v1/sensor_data";
$SUPABASE_KEY = "sb_publishable_T21IBBwYKQJzR_NKzs6m4g_calRNBij";

$lastTimestamp = "";

while(true){

    echo "Membaca RTDB...\n";

    $json = file_get_contents($RTDB_URL);
    $data = json_decode($json, true);

    if(!$data){
        echo "Gagal membaca RTDB\n";
        sleep(5);
        continue;
    }

    $timestamp = $data["timestamp"];

    if($timestamp != $lastTimestamp){

        echo "Data baru ditemukan\n";

        $payload = [
            "suhu" => $data["suhu"],
            "humidity" => $data["humidity"],
            "timestamp" => date("Y-m-d H:i:s", strtotime($timestamp))
        ];

        $options = [
            "http" => [
                "header"  => [
                    "Content-Type: application/json",
                    "apikey: $SUPABASE_KEY",
                    "Authorization: Bearer $SUPABASE_KEY",
                    "Prefer: return=minimal"
                ],
                "method"  => "POST",
                "content" => json_encode($payload)
            ]
        ];

        $context = stream_context_create($options);

        $result = file_get_contents($SUPABASE_URL, false, $context);

        echo "Data berhasil dikirim ke Supabase\n";

        $lastTimestamp = $timestamp;
    }

    sleep(50);
}