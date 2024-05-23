export const sleep = async (ms: number) =>
    new Promise((resolve) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            resolve(true);
        }, ms);
    });
