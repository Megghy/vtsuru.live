export interface APIRoot<T> {
    code: number;
    message: string;
    data: T;
}
