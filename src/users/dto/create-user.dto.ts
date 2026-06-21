import { IsNotEmpty, IsNumber, isNumber, IsString ,Length} from "class-validator";

export class CreateUserDto {

    @IsString()
    @IsNotEmpty()
    name!: string;
    
    @IsString()
    @IsNotEmpty()
    password!: string;
    
    @IsNotEmpty()
    @IsNumber()
    @Length(10, 10)
    phone!: number;
    
    accountStatus!: boolean;

}