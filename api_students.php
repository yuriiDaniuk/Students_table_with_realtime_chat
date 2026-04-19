<?php
// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, PUT, DELETE, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Handle CORS preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Connection (PDO)
$host = 'localhost';
$db_name = 'pvi_students_db';
$username = 'root';
$password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(["status" => false, "error" => ["message" => "Помилка підключення до БД: " . $e->getMessage()]]);
    exit();
}

function validateStudentData($data) {
    $errors = [];

    $group = trim($data['group'] ?? '');
    if (!preg_match('/^[A-Z]{2}-\d{2}$/', $group)) {
        $errors['group'] = "Group must be in format KN-21 (2 letters, a hyphen, 2 digits).";
    }

    $cleanFirstname = str_replace(" ", "", trim($data['firstname'] ?? ''));
    $cleanLastname = str_replace(" ", "", trim($data['lastname'] ?? ''));
    
    $nameRegex = "/^[\p{L}\-']{2,}$/u";

    if (!preg_match($nameRegex, $cleanFirstname)) {
        $errors['firstname'] = "First name must be at least 2 characters long and contain only letters.";
    }
    if (!preg_match($nameRegex, $cleanLastname)) {
        $errors['lastname'] = "Last name must be at least 2 characters long and contain only letters.";
    }

    $birthdayStr = $data['birthday'] ?? '';
    if (empty($birthdayStr)) {
        $errors['birthday'] = "Birthday is required.";
    } else {
        try {
            $selectedDate = new DateTime($birthdayStr);
            $today = new DateTime('today'); 

            if ($selectedDate > $today) {
                $errors['birthday'] = "Birthday cannot be in the future.";
            } else {
                $age = $selectedDate->diff($today)->y;

                if ($age < 16) {
                    $errors['birthday'] = "Student must be at least 16 years old.";
                } elseif ($age > 100) {
                    $errors['birthday'] = "Student cannot be older than 100 years.";
                }
            }
        } catch (Exception $e) {
            $errors['birthday'] = "Invalid date format.";
        }
    }

    return $errors;
}

// Read JSON Payload
$method = $_SERVER['REQUEST_METHOD'];
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?? [];

// CRUD Operations Router
switch ($method) {
    case 'GET':
        $stmt = $conn->prepare("SELECT id, group_name as `group`, firstname, lastname, gender, birthday, status FROM students");
        $stmt->execute();
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["status" => true, "data" => $students]);
        break;

    case 'POST':
        $validationErrors = validateStudentData($data);

        if (!empty($validationErrors)) {
            echo json_encode([
                "status" => false, 
                "error" => [
                    "message" => "Validation failed", 
                    "details" => $validationErrors 
                ]
            ]);
            exit();
        }
        
        $sql = "INSERT INTO students (group_name, firstname, lastname, gender, birthday, status) VALUES (:group_name, :firstname, :lastname, :gender, :birthday, 'active')";
        $stmt = $conn->prepare($sql);
        
        try {
            $stmt->execute([
                ':group_name' => $data['group'],
                ':firstname' => $data['firstname'],
                ':lastname' => $data['lastname'],
                ':gender' => $data['gender'] ?? 'M',
                ':birthday' => $data['birthday']
            ]);
            $newId = $conn->lastInsertId();
            echo json_encode(["status" => true, "id" => $newId]);
        } catch(Exception $e) {
            echo json_encode(["status" => false, "error" => ["message" => "Помилка збереження: " . $e->getMessage()]]);
        }
        break;

    case 'PUT':
        if (empty($data['id'])) {
            echo json_encode(["status" => false, "error" => ["message" => "Student ID is required"]]);
            exit();
        }

        $validationErrors = validateStudentData($data);
        if (!empty($validationErrors)) {
            echo json_encode([
                "status" => false, 
                "error" => [
                    "message" => "Validation failed", 
                    "details" => $validationErrors
                ]
            ]);
            exit();
        }
        
        $sql = "UPDATE students SET group_name = :group_name, firstname = :firstname, lastname = :lastname, gender = :gender, birthday = :birthday WHERE id = :id";
        $stmt = $conn->prepare($sql);
        
        try {
            $stmt->execute([
                ':id' => $data['id'],
                ':group_name' => $data['group'],
                ':firstname' => $data['firstname'],
                ':lastname' => $data['lastname'],
                ':gender' => $data['gender'],
                ':birthday' => $data['birthday']
            ]);
            echo json_encode(["status" => true, "message" => "Student updated successfully"]);
        } catch(Exception $e) {
            echo json_encode(["status" => false, "error" => ["message" => "Помилка оновлення: " . $e->getMessage()]]);
        }
        break;

    case 'DELETE':
        if (empty($data['id'])) {
            echo json_encode(["status" => false, "error" => ["message" => "Student ID is required"]]);
            exit();
        }
        
        $sql = "DELETE FROM students WHERE id = :id";
        $stmt = $conn->prepare($sql);
        
        try {
            $stmt->execute([':id' => $data['id']]);
            if ($stmt->rowCount() > 0) {
                echo json_encode(["status" => true, "message" => "Student deleted successfully"]);
            } else {
                echo json_encode(["status" => false, "error" => ["message" => "Студента не знайдено"]]);
            }
        } catch(Exception $e) {
            echo json_encode(["status" => false, "error" => ["message" => "Помилка видалення: " . $e->getMessage()]]);
        }
        break;

    default:
        echo json_encode(["status" => false, "error" => ["message" => "Method not allowed"]]);
        break;
}
?>