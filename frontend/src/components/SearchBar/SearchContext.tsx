import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearchContext = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchContext must be used within a SearchProvider");
  }
  return context;
};

interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const clearSearch = () => {
    setSearchTerm("");
  };

  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm, clearSearch }}>
      {children}
    </SearchContext.Provider>
  );
};
