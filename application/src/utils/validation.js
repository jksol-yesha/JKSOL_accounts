export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
    // Basic validation: 10-15 digits, allows optional + at start
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;
    return phoneRegex.test(phone);
};


export const isRequired = (value) => {
    return value !== null && value !== undefined && value.trim() !== '';
};
