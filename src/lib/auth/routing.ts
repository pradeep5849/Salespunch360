export function authenticatedHome(user:{role:string;salesRole?:string|null;salesAccessActive?:boolean;accountRole?:string|null;accountAccessActive?:boolean}){
 if(user.role==="SUPER_ADMIN")return "/admin";
 if(user.salesRole&&user.salesAccessActive)return "/workspace";
 if(user.accountRole&&user.accountAccessActive)return "/workspace/employees";
 return "/sign-in";
}
