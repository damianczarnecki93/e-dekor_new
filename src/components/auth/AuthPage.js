import React, { useState } from 'react';
import LoginView from './LoginView';
import RegisterView from './RegisterView';

const AuthPage = ({ onLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            {isLoginView
                ? <LoginView onLogin={onLogin} showRegister={() => setIsLoginView(false)} />
                : <RegisterView showLogin={() => setIsLoginView(true)} />}
        </div>
    );
};

export default AuthPage;