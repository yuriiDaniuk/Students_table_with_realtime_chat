import Header from './Header';
import Sidebar from './Sidebar';

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-[#f4f4f4] font-sans">
            <Header />
            <div className="flex flex-1 overflow-hidden bg-white">
                <Sidebar />
                <div className="flex-1 p-10 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;