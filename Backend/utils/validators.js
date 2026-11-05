function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;

    if (!regex.test(dateStr)) {
        return false;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function isValidTime(timeStr) {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

    if (!regex.test(timeStr)) {
        return false;
    }

    return regex.test(timeStr);
}

function isValidPartySize(s) {
    const partySize = Number(s);
    return Number.isInteger(partySize) && partySize > 0;
}

module.exports = {
    isValidDate,
    isValidTime,
    isValidPartySize
};