import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '@shared/infrastructure/filters/global-exception.filter';
import {
  ValidationException,
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '@shared/domain/exceptions';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  describe('catch', () => {
    describe('when ValidationException is thrown', () => {
      it('then responds with 400 Bad Request', () => {
        // Arrange
        const exception = new ValidationException('Validation failed', {
          name: ['name must not be empty'],
        });

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: { name: ['name must not be empty'] },
          }),
        );
      });
    });

    describe('when NotFoundException is thrown', () => {
      it('then responds with 404 Not Found', () => {
        // Arrange
        const exception = new NotFoundException('Product not found');

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 404,
            error: 'Not Found',
            message: 'Product not found',
          }),
        );
      });
    });

    describe('when ConflictException is thrown', () => {
      it('then responds with 409 Conflict', () => {
        // Arrange
        const exception = new ConflictException('Email already exists', {
          email: 'test@example.com',
        });

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 409,
            error: 'Conflict',
            message: 'Email already exists',
            details: { email: 'test@example.com' },
          }),
        );
      });
    });

    describe('when BusinessRuleException is thrown', () => {
      it('then responds with 422 Unprocessable Entity', () => {
        // Arrange
        const exception = new BusinessRuleException('Insufficient stock', {
          productId: 'abc-123',
          requested: 50,
          available: 30,
        });

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 422,
            error: 'Unprocessable Entity',
            message: 'Insufficient stock',
            details: { productId: 'abc-123', requested: 50, available: 30 },
          }),
        );
      });
    });

    describe('when NestJS HttpException is thrown', () => {
      it('then responds with the HttpException status code', () => {
        // Arrange
        const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Forbidden',
          }),
        );
      });
    });

    describe('when NestJS validation pipe error is thrown', () => {
      it('then responds with 400 and validation details', () => {
        // Arrange
        const exception = new HttpException(
          {
            statusCode: 400,
            message: ['name must not be empty', 'price must be positive'],
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: {
              errors: ['name must not be empty', 'price must be positive'],
            },
          }),
        );
      });
    });

    describe('when an unknown error is thrown', () => {
      it('then responds with 500 Internal Server Error', () => {
        // Arrange
        const exception = new Error('Something unexpected');

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
          }),
        );
      });
    });

    describe('response format', () => {
      it('always includes a timestamp in ISO format', () => {
        // Arrange
        const exception = new NotFoundException('Not found');

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        const responseBody = mockResponse.json.mock.calls[0][0];
        expect(responseBody.timestamp).toBeDefined();
        expect(new Date(responseBody.timestamp).toISOString()).toBe(responseBody.timestamp);
      });

      it('omits details when exception has no details', () => {
        // Arrange
        const exception = new NotFoundException('Not found');

        // Act
        filter.catch(exception, mockHost as unknown as ArgumentsHost);

        // Assert
        const responseBody = mockResponse.json.mock.calls[0][0];
        expect(responseBody.details).toBeUndefined();
      });
    });
  });
});
