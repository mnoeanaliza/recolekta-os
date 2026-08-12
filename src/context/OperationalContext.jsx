import React, { createContext, useContext, useMemo } from 'react';

const OperationalContext = createContext();

export const OperationalProvider = ({
    children,
    filtroZona,
    perfilesUsuarios,
    catalogCountry,
    catalogs
}) => {

    const value = useMemo(() => ({
        filtroZona,
        perfilesUsuarios,
        catalogCountry,
        catalogs
    }), [
        filtroZona,
        perfilesUsuarios,
        catalogCountry,
        catalogs
    ]);

    return (
        <OperationalContext.Provider value={value}>
            {children}
        </OperationalContext.Provider>
    );
};
export const useOperational = () => {
    return useContext(OperationalContext);
};