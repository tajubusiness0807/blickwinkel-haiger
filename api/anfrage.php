<?php
/**
 * Empfängt Termin-Anfragen und Kontaktlinsen-Nachbestellungen der Website
 * und leitet sie per E-Mail an das Geschäft weiter.
 *
 * Voraussetzung: PHP-Hosting mit funktionierender mail()-Funktion
 * (bei den meisten deutschen Webhostern Standard).
 * Ohne PHP öffnet die Website automatisch das E-Mail-Programm der Besucher.
 */

declare(strict_types=1);

const RECIPIENT = 'info@blickwinkel-haiger.de';
// Absenderadresse muss zur eigenen Domain gehören, damit die Mails nicht im Spam landen.
const SENDER = 'website@blickwinkel-haiger.de';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function field(string $key, int $max = 500): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = trim(str_replace("\0", '', $value));
    return mb_substr($value, 0, $max, 'UTF-8');
}

function oneLine(string $value): string
{
    return trim((string) preg_replace('/[\r\n\t]+/', ' ', $value));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Methode nicht erlaubt.']);
}

// Spam-Schutz: verstecktes Feld und unrealistisch schnelles Absenden
if (field('website') !== '' || (int) field('_elapsed', 10) < 3) {
    respond(200, ['ok' => true]);
}

$type = field('type', 20);
if (!in_array($type, ['termin', 'bestellung'], true)) {
    respond(400, ['ok' => false, 'error' => 'Unbekannte Anfrage.']);
}

$name = oneLine(field('name', 120));
$email = oneLine(field('email', 160));
$phone = oneLine(field('telefon', 40));
$message = field('nachricht', 2000);

if ($name === '' || $phone === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || field('datenschutz', 20) !== 'akzeptiert') {
    respond(422, ['ok' => false, 'error' => 'Bitte füllen Sie alle Pflichtfelder aus.']);
}

if ($type === 'termin') {
    $topic = oneLine(field('anliegen', 80));
    $subject = "Terminanfrage: {$topic} – {$name}";
    $lines = [
        'Neue Terminanfrage über die Website',
        '',
        "Anliegen:      {$topic}",
        'Wunschtermin:  ' . oneLine(field('wunschtermin', 120)),
        "Name:          {$name}",
        "Telefon:       {$phone}",
        "E-Mail:        {$email}",
    ];
} else {
    $subject = "Kontaktlinsen-Nachbestellung – {$name}";
    $lines = [
        'Neue Kontaktlinsen-Nachbestellung über die Website',
        '',
        field('bestellung', 4000),
    ];
}
if ($message !== '') {
    $lines[] = '';
    $lines[] = 'Nachricht:';
    $lines[] = $message;
}
$lines[] = '';
$lines[] = '— Die Datenschutzbestimmungen wurden akzeptiert. Antworten Sie direkt auf diese E-Mail, um die Kundin bzw. den Kunden zu erreichen.';

$replyName = str_replace(['"', '<', '>', ','], '', $name);
$headers = [
    'From: =?UTF-8?B?' . base64_encode('Website Blickwinkel') . '?= <' . SENDER . '>',
    'Reply-To: =?UTF-8?B?' . base64_encode($replyName) . '?= <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

$sent = @mail(
    RECIPIENT,
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    implode("\r\n", $lines),
    implode("\r\n", $headers)
);

if (!$sent) {
    respond(500, ['ok' => false, 'error' => 'Die Nachricht konnte nicht gesendet werden.']);
}

respond(200, ['ok' => true]);
