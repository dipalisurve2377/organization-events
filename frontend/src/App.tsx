import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import UserTable from "./components/Table/UserTable";
import OrganizationTable from "./components/Table/OrganizationTable";
import EditUser from "./pages/User/EditUser";
import Signup from "./pages/User/Signup";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import { Routes, Route, useNavigate } from "react-router-dom";
import { SearchProvider } from "./components/SearchBar/SearchContext";
import Button from "./components/Button/Button";

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
          onClick={() => navigate("/signup")}
          className="create-user-button"
        >
          Create User
        </Button>
      </div>
      <UserTable />
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
                path="/signup"
                element={
                  <ProtectedRoute>
                    <Signup />
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
                    <OrganizationTable />
                  </ProtectedRoute>
                }
              />
              {/* TODO: Add routes for other pages */}
              {/* <Route path="/users/update/:id" element={<UpdateUser />} /> */}
              {/* <Route path="/users/delete/:id" element={<DeleteUser />} /> */}
              {/* <Route path="/users/:id" element={<UserDetail />} /> */}
              {/* <Route path="/organizations/create" element={<CreateOrganization />} /> */}
              {/* <Route path="/organizations/edit/:id" element={<EditOrganization />} /> */}
            </Routes>
          </div>
        </div>
      </div>
    </SearchProvider>
  );
}

export default App;
