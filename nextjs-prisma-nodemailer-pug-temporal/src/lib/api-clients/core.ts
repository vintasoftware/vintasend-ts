type SuccessGenericApiResponse = {
    success: true;
    message: string;
};

type SuccessDataApiResponse<SuccessSchema> = {
    success: true;
    data: SuccessSchema;
};


type GenericErrorApiResponse = {
    success: false;
    error: string;
};


type ValidationErrorApiResponse<ValidationErrorSchema> = {
    success: false;
    error?: string;
    details: ValidationErrorSchema;
};

export type WriteApiResponse<SuccessSchema = {}, ValidationErrorSchema = {}> = SuccessGenericApiResponse | SuccessDataApiResponse<SuccessSchema> | GenericErrorApiResponse | ValidationErrorApiResponse<ValidationErrorSchema>;
