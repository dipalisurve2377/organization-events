import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import UserTable from "./components/Table/UserTable";
import OrganizationTable from "./components/Table/OrganizationTable";
import EditUser from "./pages/User/EditUser";
import CreateUser from "./pages/User/CreateUser";
import CreateOrganization from "./pages/Organization/CreateOrganization";
import EditOrganization from "./pages/Organization/EditOrganization";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import { Routes, Route, useNavigate } from "react-router-dom";
import { SearchProvider } from "./components/SearchBar/SearchContext";
import Button from "./components/Button/Button";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function UsersHomeWrapper() {
  const navigate = useNavigate();
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 24,
        }}
      >
        <Button
          variant="primary"
          size="medium"
          onClick={() => navigate("/create-user")}
          className="create-user-button"
        >
          Create User
        </Button>
      </div>
      <UserTable />
    </div>
  );
}

function OrganizationsHomeWrapper() {
  const navigate = useNavigate();
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 24,
        }}
      >
        <Button
          variant="primary"
          size="medium"
          onClick={() => navigate("/organizations/create")}
          className="create-user-button"
        >
          Create Organization
        </Button>
      </div>
      <OrganizationTable />
    </div>
  );
}

function App() {
  return (
    <SearchProvider>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          <Navbar />
          <div style={{ padding: "40px" }}>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <UsersHomeWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-user"
                element={
                  <ProtectedRoute>
                    <CreateUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users/edit/:id"
                element={
                  <ProtectedRoute>
                    <EditUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations"
                element={
                  <ProtectedRoute>
                    <OrganizationsHomeWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/create"
                element={
                  <ProtectedRoute>
                    <CreateOrganization />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/edit/:id"
                element={
                  <ProtectedRoute>
                    <EditOrganization />
                  </ProtectedRoute>
                }
              />
              {/* TODO: Add routes for other pages */}
              {/* <Route path="/users/update/:id" element={<UpdateUser />} /> */}
              {/* <Route path="/users/delete/:id" element={<DeleteUser />} /> */}
              {/* <Route path="/users/:id" element={<UserDetail />} /> */}
              {/* <Route path="/organizations/edit/:id" element={<EditOrganization />} /> */}
            </Routes>
          </div>
        </div>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </SearchProvider>
  );
}

export default App;
