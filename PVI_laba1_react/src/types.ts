export interface Student {
    id: number;
    group: string;
    firstname: string;
    lastname: string;
    gender: 'M' | 'F';
    birthday: string;
    status: 'active' | 'offline';
}

export type NewStudentData = Omit<Student, 'id' | 'status'>;