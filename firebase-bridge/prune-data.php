<?php
/**
 * Prune Sensor Data
 * Menghapus data sensor yang lebih lama dari 7 hari dari Firestore
 * Dijalankan via GitHub Actions setiap hari
 */

// Konfigurasi
$retentionDays = 7;
$collectionName = 'sensor_history';
$projectId = getenv('FIRESTORE_PROJECT_ID') ?: 'data-center-40843';

// Setup logging
$logDir = __DIR__ . '/../logs';
if (!file_exists($logDir)) {
    mkdir($logDir, 0777, true);
}

$logFile = $logDir . '/prune_' . date('Y-m-d') . '.log';

function writeLog($message, $logFile) {
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
    echo $logMessage;
}

writeLog("========== PRUNING PROCESS STARTED ==========", $logFile);
writeLog("Retention: $retentionDays hari", $logFile);

// Hitung tanggal cutoff
$cutoffDate = new DateTime("-$retentionDays days");
$cutoffTimestamp = $cutoffDate->format('Y-m-d\TH:i:s.u\Z');
writeLog("Menghapus data sebelum: " . $cutoffDate->format('Y-m-d H:i:s'), $logFile);

// Fungsi untuk mendapatkan access token dari service account
function getAccessToken($serviceAccountPath) {
    if (!file_exists($serviceAccountPath)) {
        writeLog("Service account tidak ditemukan: $serviceAccountPath", $GLOBALS['logFile']);
        return null;
    }
    
    $serviceAccount = json_decode(file_get_contents($serviceAccountPath), true);
    
    // JWT Header
    $header = base64_encode(json_encode([
        'alg' => 'RS256',
        'typ' => 'JWT'
    ]));
    
    // JWT Payload
    $now = time();
    $payload = base64_encode(json_encode([
        'iss' => $serviceAccount['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore',
        'aud' => 'k49ulIKjMWKnte1LD3eQZmki4byUmhzFWC0TqRIr',
        'exp' => $now + 3600,
        'iat' => $now
    ]));
    
    // Sign JWT
    $signature = '';
    $privateKey = openssl_get_privatekey($serviceAccount['private_key']);
    openssl_sign($header . '.' . $payload, $signature, $privateKey, 'SHA256');
    $jwt = $header . '.' . $payload . '.' . base64_encode($signature);
    
    // Dapatkan access token
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'k49ulIKjMWKnte1LD3eQZmki4byUmhzFWC0TqRIr');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

// Fungsi untuk query dan hapus data lama
function deleteOldData($projectId, $accessToken, $collectionName, $cutoffTimestamp) {
    $totalDeleted = 0;
    $batchCount = 0;
    
    while (true) {
        // Query data lama (limit 100 per batch)
        $queryUrl = "https://firestore.googleapis.com/v1/projects/data-center-40843/databases/(default)/documents/sensor_history";
        
        $body = [
            'structuredQuery' => [
                'from' => [['collectionId' => $collectionName]],
                'where' => [
                    'fieldFilter' => [
                        'field' => ['fieldPath' => 'timestamp'],
                        'op' => 'LESS_THAN',
                        'value' => ['timestampValue' => $cutoffTimestamp]
                    ]
                ],
                'limit' => 100
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $queryUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer " . $accessToken,
            "Content-Type: application/json"
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $results = json_decode($response, true);
        $documents = [];
        
        foreach ($results as $result) {
            if (isset($result['document'])) {
                $documents[] = $result['document'];
            }
        }
        
        if (empty($documents)) {
            break;
        }
        
        // Hapus dokumen satu per satu
        $batchDeleted = 0;
        foreach ($documents as $doc) {
            $docPath = str_replace("projects/{$projectId}/databases/(default)/documents/", '', $doc['name']);
            $deleteUrl = "https://firestore.googleapis.com/v1/projects/data-center-40843/databases/(default)/documents/sensor_history";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $deleteUrl);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer " . $accessToken
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200 || $httpCode === 204) {
                $batchDeleted++;
                $totalDeleted++;
            }
        }
        
        $batchCount++;
        writeLog("Batch $batchCount: Menghapus $batchDeleted dokumen (Total: $totalDeleted)", $GLOBALS['logFile']);
        
        // Hentikan jika sudah tidak ada data
        if (count($documents) < 100) {
            break;
        }
    }
    
    return $totalDeleted;
}

// Eksekusi pruning
$serviceAccountPath = __DIR__ . '/../service-account.json';

// Cek apakah running di GitHub Actions (pakai secrets)
if (getenv('GCP_SA_KEY')) {
    writeLog("Menggunakan GCP_SA_KEY dari environment variable", $logFile);
    $saJson = base64_decode(getenv('GCP_SA_KEY'));
    file_put_contents($serviceAccountPath, $saJson);
}

if (file_exists($serviceAccountPath)) {
    $accessToken = getAccessToken($serviceAccountPath);
    
    if ($accessToken) {
        $deletedCount = deleteOldData($projectId, $accessToken, $collectionName, $cutoffTimestamp);
        writeLog("SUKSES: Total $deletedCount data dihapus", $logFile);
    } else {
        writeLog("GAGAL: Tidak bisa mendapatkan access token", $logFile);
    }
} else {
    writeLog("GAGAL: Service account tidak ditemukan", $logFile);
    writeLog("Pastikan file service-account.json ada atau GCP_SA_KEY sudah diset", $logFile);
}

writeLog("========== PRUNING PROCESS COMPLETED ==========", $logFile);