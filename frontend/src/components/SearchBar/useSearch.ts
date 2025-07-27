import { useState, useCallback } from "react";

export const useSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  return {
    searchTerm,
    handleSearch,
    clearSearch,
  };
};
