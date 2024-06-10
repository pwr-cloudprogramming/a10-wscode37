// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './loginPage.tsx';
import PlayPage from './play.js';
import ConfirmUserPage from './confirmUserPage.tsx';
import './App.css'
import React from 'react';

const App = () => {
  const isAuthenticated = () => {
    const accessToken = sessionStorage.getItem('accessToken');
    return !!accessToken;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isAuthenticated() ? <PlayPage /> : <LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/confirm" element={<ConfirmUserPage />} />
        <Route path="/home" element={isAuthenticated() ? <PlayPage /> : <LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
