import { NavLink } from 'react-router-dom';

function Sidebar() {
    const baseStyle = "block text-base text-gray-600 mb-4 cursor-pointer transition-colors hover:text-black hover:font-bold";
    const activeStyle = "text-black font-bold";

    return (
        <div className="w-[200px] p-5 bg-[#fdfdfd] border-r border-gray-300">
            <NavLink to="/dashboard" className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : ''}`}>Dashboard</NavLink>
            <NavLink to="/" className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : ''}`}>Students</NavLink>
            <NavLink to="/tasks" className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : ''}`}>Tasks</NavLink>
        </div>
    );
};

export default Sidebar;