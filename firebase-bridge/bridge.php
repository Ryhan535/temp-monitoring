<?php

$RTDB_URL = "https://data-center-40843-default-rtdb.asia-southeast1.firebasedatabase.app/latest.json";

$FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/data-center-40843/databases/(default)/documents/sensor_history";
//$FIRESTORE_URL = "https://console.firebase.google.com/u/0/project/data-center-40843/firestore/databases/-default-/data/~2Fsensor_history";

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

    // cek apakah data baru
    if($timestamp != $lastTimestamp){

        echo "Data baru ditemukan\n";

        $payload = [
            "fields" => [
                "suhu" => [
                    "doubleValue" => $data["suhu"]
                ],
                "humidity" => [
                    "doubleValue" => $data["humidity"]
                ],
                "timestamp" => [
                    "stringValue" => $timestamp
                ],
                "epoch" => [
                    "integerValue" => time()
                ]
            ]
        ];

        $options = [
            "http" => [
                "header"  => "Content-Type: application/json",
                "method"  => "POST",
                "content" => json_encode($payload)
            ]
        ];

        $context = stream_context_create($options);

        $result = file_get_contents($FIRESTORE_URL, false, $context);

        echo "Data berhasil dikirim ke Firestore\n";

        $lastTimestamp = $timestamp;
    }

    sleep(50);
}