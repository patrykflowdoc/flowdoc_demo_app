const POLISH_MONTHS = [
    'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

export const formatPolishDate = (dateInput, time) => {
    if (!dateInput) return '';
    
    let date;
    if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        return String(dateInput);
    }
    
    if (isNaN(date.getTime())) return String(dateInput);
    
    const day = date.getDate();
    const month = POLISH_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    
    let result = `${day} ${month} ${year}`;
    if (time) {
        result += `, godz. ${time}`;
    }
    return result;
};

export const formatPolishWeddingDate = (dateInput) => {
    if (!dateInput) return '';
    
    let date;
    if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        return String(dateInput);
    }
    
    if (isNaN(date.getTime())) return String(dateInput);
    
    const day = date.getDate();
    const month = POLISH_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
};