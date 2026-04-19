import { useEffect, useState } from "react";
import type { Student, NewStudentData } from "./types";

// --- Component State ---
function Students() {
  // State Hooks
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] =
    useState<boolean>(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [exceptionMessage, setExceptionMessage] = useState<
    "notAllFilled" | "areYouSureYouWantToDelete" | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteModalText, setDeleteModalText] = useState<string>(
    "Are you sure you want to delete this student?",
  );
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  const [students, setStudents] = useState<Student[]>([]);

  const [formData, setFormData] = useState<NewStudentData>({
    group: "",
    firstname: "",
    lastname: "",
    gender: "M",
    birthday: "",
  });

  const [formErrors, setFormErrors] = useState<{
    group?: string;
    firstname?: string;
    lastname?: string;
    birthday?: string;
  }>({});

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Derived State & Variables
  const ITEMS_PER_PAGE = 5;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentStudents = students.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );
  const uniqueGroups = Array.from(new Set(students.map((s) => s.group)));
  const isAllChecked =
    currentStudents.length > 0 &&
    currentStudents.every((student) => selectedIds.includes(student.id));

  // Effect Hooks
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await fetch('http://localhost/students_api/api.php');
        const data = await response.json();
        if (data.status === true) {
          setStudents(data.data);
        } else {
          console.error('Failed to fetch students:', data.error);
        }
      } catch (error) {
        console.error('Network error fetching students:', error);
      }
    };
    fetchStudents();
  }, []);

  // Event Handlers
  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      const currentIds = currentStudents.map((student) => student.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...currentIds])));
    } else {
      const currentIds = currentStudents.map((student) => student.id);
      setSelectedIds(selectedIds.filter((id) => !currentIds.includes(id)));
    }
  }

  function handleSelectOne(id: number) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  function handleDelete(id: number) {
    let idsToDelete: number[] = [];

    // Allow deleting multiple selected students or fallback to single row
    if (selectedIds.length > 0) {
      idsToDelete = [...selectedIds];
    } else {
      idsToDelete = [id];
    }

    if (idsToDelete.length === 1) {
      const student = students.find((s) => s.id === idsToDelete[0]);
      if (student) {
        setDeleteModalText(
          `Are you sure you want to delete user ${student.firstname} ${student.lastname} ?`,
        );
      }
    } else if (idsToDelete.length > 1) {
      setDeleteModalText(
        `Are you sure you want to delete ${idsToDelete.length} selected users ?`,
      );
    }

    setDeletingIds(idsToDelete);
    setExceptionMessage("areYouSureYouWantToDelete");
    setIsExceptionModalOpen(true);
  }

  async function confirmDelete() {
    if (deletingIds.length === 0) {
      return;
    }

    try {
      for (const id of deletingIds) {
        const response = await fetch('http://localhost/students_api/api.php', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();
        if (data.status !== true) {
          alert(data.message || data.error?.message || "Помилка сервера");
          return;
        }
      }

      setStudents((prev) =>
        prev.filter((student) => !deletingIds.includes(student.id)),
      );

      setSelectedIds((prev) => prev.filter((id) => !deletingIds.includes(id)));

      const remainingCount = students.filter(
        (s) => !deletingIds.includes(s.id),
      ).length;
      const maxPages = Math.ceil(remainingCount / ITEMS_PER_PAGE) || 1;

      if (currentPage > maxPages) {
        setCurrentPage(maxPages);
      }

      setIsExceptionModalOpen(false);
      setDeletingIds([]);
    } catch (error : { message: string } | unknown) {
      alert('Network error: ' + (error as { message: string }).message);
    }
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function validateForm(data: NewStudentData) {
    const errors: {
      group?: string;
      firstname?: string;
      lastname?: string;
      birthday?: string;
    } = {};

    const groupRegex = /^[A-Z]{2}-\d{2}$/;
    if (!groupRegex.test(data.group.trim())) {
      errors.group =
        "Group must be in format KN-21 (2 letters, a hyphen, 2 digits).";
    }

    const cleanFirstname = data.firstname.replaceAll(" ", "").trim();
    const cleanLastname = data.lastname.replaceAll(" ", "").trim();

    const nameRegex = /^[\p{L}\-']{2,}$/u;

    if (!nameRegex.test(cleanFirstname)) {
      errors.firstname =
        "First name must be at least 2 characters long and contain only letters.";
    }
    if (!nameRegex.test(cleanLastname)) {
      errors.lastname =
        "Last name must be at least 2 characters long and contain only letters.";
    }

    if (!data.birthday) {
      errors.birthday = "Birthday is required.";
    } else {
      const selectedDate = new Date(data.birthday);
      const today = new Date();
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDate > today) {
        errors.birthday = "Birthday cannot be in the future.";
      } else {
        let age = today.getFullYear() - selectedDate.getFullYear();
        
        const monthDiff = today.getMonth() - selectedDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDate.getDate())) {
          age--; 
        }

        if (age < 16) {
          errors.birthday = "Student must be at least 16 years old.";
        } else if (age > 100) {
          errors.birthday = "Student cannot be older than 100 years.";
        }
      }
    }

    return errors;
  }

  async function handleSave() {
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    function formatName(name: string): string {
      const cleaned = name.replaceAll(" ", "").trim();
      const parts = cleaned.split("-");
      const formattedParts = parts.map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      return formattedParts.join("-");
    }

    const finalFirstname = (formatName(formData.firstname)) + " ";
    const finalLastname = formatName(formData.lastname);

    let formattedDate = "-";
    if (formData.birthday) {
      formattedDate = new Date(formData.birthday).toLocaleDateString("uk-UA");
    }

    if (editingStudentId) {
      const updatedStudent: Student = {
        id: editingStudentId,
        group: formData.group,
        firstname: finalFirstname,
        lastname: finalLastname,
        gender: formData.gender as "M" | "F",
        birthday: formattedDate,
        status: "active",
      };

      try {
        const response = await fetch('http://localhost/students_api/api.php', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedStudent),
        });
        const data = await response.json();
        if (data.status === true) {
          setStudents((prev) =>
            prev.map((student) =>
              student.id === editingStudentId
                ? { ...student, ...formData, birthday: formattedDate, firstname: finalFirstname, lastname: finalLastname }
                : student,
            ),
          );
          setEditingStudentId(null);
          setIsModalOpen(false);
          setFormData({
            group: "",
            firstname: "",
            lastname: "",
            gender: "M",
            birthday: "",
          });
        } else {
          alert(data.message || data.error?.message || "Помилка сервера");
        }
      } catch (error: { message: string } | unknown) {
        alert('Network error: ' + (error as { message: string }).message);
      }
    } else {
      try {
        const response = await fetch('http://localhost/students_api/api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            group: formData.group,
            firstname: finalFirstname,
            lastname: finalLastname,
            gender: formData.gender,
            birthday: formattedDate,
          }),
        });
        const data = await response.json();
        if (data.status === true) {
          const newStudent: Student = {
            id: data.id,
            group: formData.group,
            firstname: finalFirstname,
            lastname: finalLastname,
            gender: formData.gender as "M" | "F",
            birthday: formattedDate,
            status: "active",
          };
          setStudents([...students, newStudent]);
          setIsModalOpen(false);
          setFormData({
            group: "",
            firstname: "",
            lastname: "",
            gender: "M",
            birthday: "",
          });
        } else {
          alert(data.message || data.error?.message || "Помилка сервера");
        }
      } catch (error: { message: string } | unknown) {
        alert('Network error: ' + (error as { message: string }).message);
      }
    }
  }

  function handleEdit(id: number) {
    const studentToEdit = students.find((s) => s.id === id);
    if (studentToEdit) {
      setEditingStudentId(studentToEdit.id);

      let dateForInput = "";
      if (studentToEdit.birthday && studentToEdit.birthday !== "-") {
        const parts = studentToEdit.birthday.split(".");
        if (parts.length === 3) {
          dateForInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      setFormErrors({});
      setFormData({
        group: studentToEdit.group,
        firstname: studentToEdit.firstname,
        lastname: studentToEdit.lastname,
        gender: studentToEdit.gender,
        birthday: dateForInput,
      });
      setIsModalOpen(true);
    }
  }

  // Render
  return (
    <>
      {/* --- HEADER & ADD BUTTON --- */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-3xl font-bold m-0">Students</h1>
        <button
          className="w-10 h-10 text-2xl bg-white border border-black flex items-center justify-center cursor-pointer hover:bg-gray-100 pb-1"
          onClick={() => {
            setEditingStudentId(null);
            setFormErrors({});
            setFormData({
              group: "",
              firstname: "",
              lastname: "",
              gender: "M",
              birthday: "",
            });
            setIsModalOpen(true);
          }}
        >
          +
        </button>
      </div>

      {/* --- STUDENTS TABLE --- */}
      <table className="w-full border-collapse border-2 border-black mb-5">
        <thead>
          <tr>
            {/* Checkbox column */}
            <th className="border border-black p-3 w-[50px]">
              <input
                type="checkbox"
                checked={isAllChecked}
                onChange={handleSelectAll}
              />
            </th>
            <th className="border border-black p-3">Group</th>
            <th className="border border-black p-3">Name</th>
            <th className="border border-black p-3">Gender</th>
            <th className="border border-black p-3">Birthday</th>
            <th className="border border-black p-3">Status</th>
            {/* Action buttons (Edit/Delete) */}
            <th className="border border-black p-3">Options</th>
          </tr>
        </thead>
        <tbody>
          {currentStudents.map((student) => (
            <tr key={student.id}>
              <td className="border border-black p-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(student.id)}
                  onChange={() => handleSelectOne(student.id)}
                />
              </td>
              <td className="border border-black p-3 text-center font-bold text-base">
                {student.group}
              </td>
              <td className="border border-black p-3 text-center font-bold text-base">
                {student.firstname} {student.lastname}
              </td>
              <td className="border border-black p-3 text-center font-bold text-base">
                {student.gender}
              </td>
              <td className="border border-black p-3 text-center font-bold text-base">
                {student.birthday}
              </td>
              <td className="border border-black p-3 text-center">
                <span
                  className={`inline-block w-4 h-4 rounded-full ${student.status === "active" ? "bg-[#6faa48]" : "bg-[#ccc]"}`}
                ></span>
              </td>
              <td className="border border-black p-3 text-center">
                <button
                  className="w-7 h-7 bg-white border border-gray-600 cursor-pointer mx-1 text-sm"
                  onClick={() => handleEdit(student.id)}
                >
                  ✎
                </button>
                <button
                  className="w-7 h-7 bg-white border border-gray-600 cursor-pointer mx-1 text-sm"
                  onClick={() => handleDelete(student.id)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}

          {/* Empty state message */}
          {currentStudents.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="border border-black p-5 text-center text-gray-500"
              >
                Немає студентів на цій сторінці
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* --- PAGINATION CONTROLS --- */}
      <div className="flex justify-center gap-2">
        <button
          className="border px-3 py-1 cursor-pointer bg-white hover:bg-gray-100"
          onClick={() => setCurrentPage((prev) => (prev === 1 ? 4 : prev - 1))}
        >
          &lt;
        </button>

        {[1, 2, 3, 4].map((page) => (
          <button
            key={page}
            className={`border px-3 py-1 cursor-pointer hover:bg-gray-100 ${currentPage === page ? "bg-gray-300 font-bold" : "bg-white"}`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}

        <button
          className="border px-3 py-1 cursor-pointer bg-white hover:bg-gray-100"
          onClick={() => setCurrentPage((prev) => (prev === 4 ? 1 : prev + 1))}
        >
          &gt;
        </button>
      </div>

      {/* --- ADD/EDIT STUDENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-500">
          <div className="bg-white p-6 rounded-lg w-[350px]">
            <h3 className="text-xl font-bold mb-4 mt-0">
              {editingStudentId ? "Edit student" : "Add student"}
            </h3>

            <div className="mb-4">
              <label className="block mb-1 font-bold text-sm">Group</label>
              <input
                type="text"
                name="group"
                list="group-list"
                value={formData.group}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="For example: KN-21"
                autoComplete="off"
              />
              {formErrors.group && (
                <p className="text-red-600 text-sm mt-1">{formErrors.group}</p>
              )}
              <datalist id="group-list">
                {uniqueGroups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-bold text-sm">First name</label>
              <input
                type="text"
                name="firstname"
                value={formData.firstname}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="For example: Ivan"
                autoComplete="off"
              />
              {formErrors.firstname && (
                <p className="text-red-600 text-sm mt-1">
                  {formErrors.firstname}
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-bold text-sm">Last Name</label>
              <input
                type="text"
                name="lastname"
                value={formData.lastname}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="For example: Petrenko"
                autoComplete="off"
              />
              {formErrors.lastname && (
                <p className="text-red-600 text-sm mt-1">
                  {formErrors.lastname}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-bold text-sm">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-bold text-sm">
                Date of birth
              </label>
              <input
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
              {formErrors.birthday && (
                <p className="text-red-600 text-sm mt-1">
                  {formErrors.birthday}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 border border-gray-600 rounded bg-white cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setFormErrors({});
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 border border-black font-bold rounded bg-white cursor-pointer hover:bg-gray-100"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {isExceptionModalOpen &&
        exceptionMessage === "areYouSureYouWantToDelete" && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]">
            <div className="bg-white rounded-xl w-[550px] flex flex-col border border-gray-400 shadow-lg">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-400">
                <h3 className="font-bold text-xl m-0">Warning</h3>
                <button
                  className="w-8 h-8 pb-1 flex items-center justify-center border border-gray-400 bg-white text-gray-600 hover:bg-gray-100 cursor-pointer text-xl"
                  onClick={() => setIsExceptionModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="py-16 px-8 flex justify-center items-center">
                <p className="font-bold text-xl text-center m-0">
                  {deleteModalText}
                </p>
              </div>

              <div className="flex justify-end gap-4 px-6 py-4 border-t border-gray-400">
                <button
                  className="px-6 py-1.5 border border-gray-400 bg-white cursor-pointer hover:bg-gray-100"
                  onClick={() => setIsExceptionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-8 py-1.5 border border-gray-400 bg-white cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    confirmDelete();
                  }}
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default Students;
