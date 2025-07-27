import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import UserTable from "./components/Table/UserTable";
import EditUser from "./pages/User/EditUser";
import Signup from "./pages/User/Signup";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import { Routes, Route } from "react-router-dom";
import { SearchProvider } from "./components/SearchBar/SearchContext";
// ...

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
                    <UserTable />
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
              {/* TODO: Add routes for other pages */}
              {/* <Route path="/users/update/:id" element={<UpdateUser />} /> */}
              {/* <Route path="/users/delete/:id" element={<DeleteUser />} /> */}
              {/* <Route path="/users/:id" element={<UserDetail />} /> */}
              {/* <Route path="/organizations/create" element={<CreateOrganization />} /> */}
              {/* <Route path="/organizations" element={<OrganizationList />} /> */}
            </Routes>
          </div>
        </div>
      </div>
    </SearchProvider>
  );
}

export default App;
