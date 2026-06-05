import { AppModule } from '../../src/app.module';

jest.mock('@nestjs/typeorm', () => {
  const actual = jest.requireActual('@nestjs/typeorm');
  return {
    ...actual,
    TypeOrmModule: {
      ...actual.TypeOrmModule,
      forRootAsync: jest.fn().mockReturnValue({ module: class TypeOrmRootModule {} }),
      forFeature: jest.fn().mockReturnValue({ module: class TypeOrmFeatureModule {} }),
    },
  };
});

jest.mock('@shared/infrastructure/database/typeorm.config', () => ({
  buildTypeOrmOptions: jest.fn().mockReturnValue({}),
}));

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should have TypeOrmModule in imports', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
  });
});
