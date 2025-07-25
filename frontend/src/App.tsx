import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import UserTable from "./components/Table/UserTable";
import EditUser from "./pages/User/EditUser";
import { Routes, Route } from "react-router-dom";
// ...

function App() {
  return (
    <>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          <Navbar />
          <div style={{ padding: "40px" }}>
            <Routes>
              <Route path="/" element={<UserTable />} />
              <Route path="/users/edit/:id" element={<EditUser />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
