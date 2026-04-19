import React, { useState, useEffect } from "react";

interface Student {
  id: string;
  firstname: string;
  lastname: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await fetch("http://localhost/students_api/api.php");
        const data = await response.json();

        setStudents(data.data);
      } catch (error) {
        console.error("Failed to fetch students:", error);
      }
    };
    fetchStudents();
  }, []);

  if (!isOpen) return null;

  const handleLogin = () => {
    // Перевіряємо, чи взагалі когось обрали
    if (!selectedStudent) {
      alert("Будь ласка, оберіть студента зі списку!");
      return;
    }

    // Шукаємо студента в масиві. Перетворюємо обидва ID на рядки (String),
    // щоб уникнути конфлікту між числом 8 і рядком "8"
    const user = students.find((s) => String(s.id) === String(selectedStudent));

    if (user) {
      // Зберігаємо об'єкт користувача у локальну пам'ять
      localStorage.setItem("currentUser", JSON.stringify(user));

      // Закриваємо модальне вікно
      if (onClose) onClose();

      // Перезавантажуємо сторінку, щоб шапка і чат побачили нового користувача
      window.location.reload();
    } else {
      console.error("Користувача не знайдено. Обраний ID:", selectedStudent);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Log In / Register
        </h2>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Student
          </label>
          <select
            // Гарантуємо, що значення ніколи не буде undefined
            value={selectedStudent || ""}
            onChange={(e) => setSelectedStudent(e.target.value)}
            // Додали text-black та bg-white для 100% видимості
            className="w-full p-3 border border-gray-300 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#A8A5D8]"
          >
            {/* disabled не дає користувачу знову вибрати цей порожній рядок */}
            <option value="" disabled>
              -- Choose a student --
            </option>

            {Array.isArray(students) &&
              students.map((student) => (
                // Суворо перетворюємо ID на рядок для ідеального співпадіння
                <option key={student.id} value={String(student.id)}>
                  {student.firstname} {student.lastname}
                </option>
              ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleLogin}
            disabled={!selectedStudent}
            className="flex-1 px-4 py-2 bg-[#A8A5D8] text-white font-semibold rounded-lg hover:bg-[#8F8CC2] disabled:bg-gray-400 transition"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}
