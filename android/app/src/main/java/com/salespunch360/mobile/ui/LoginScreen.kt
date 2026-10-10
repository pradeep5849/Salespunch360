package com.salespunch360.mobile.ui

import android.util.Patterns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.salespunch360.mobile.data.RegistrationLogo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import coil3.compose.AsyncImage
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.R
import com.salespunch360.mobile.data.ApiException
import com.salespunch360.mobile.data.RegistrationClient
import com.salespunch360.mobile.data.SecureSession
import java.io.IOException
import kotlinx.coroutines.launch

@Composable fun LoginScreen(message:String?,submitting:Boolean,onEdit:()->Unit,onLogin:(String,String,Boolean)->Unit,onSignUp:()->Unit){
 var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var rememberMe by remember{mutableStateOf(false)};var visible by remember{mutableStateOf(false)};var attempted by remember{mutableStateOf(false)};val context=LocalContext.current;val passwordFocus=remember{FocusRequester()};val focus=LocalFocusManager.current;val validEmail=Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
 Column(Modifier.fillMaxSize().background(SalesPale).verticalScroll(rememberScrollState()).imePadding().navigationBarsPadding().padding(horizontal=16.dp,vertical=24.dp),horizontalAlignment=Alignment.CenterHorizontally){
 Surface(shape=RoundedCornerShape(18.dp),border=BorderStroke(1.dp,SalesLine),color=Color.White,modifier=Modifier.fillMaxWidth()){Column(Modifier.fillMaxWidth().padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally){
  Image(painter=painterResource(R.drawable.salespunch360_logo),contentDescription="SalesPunch360 — Track. Punch. Perform.",modifier=Modifier.fillMaxWidth().heightIn(max=150.dp),contentScale=ContentScale.Fit);Spacer(Modifier.height(12.dp));Text("Field force management, simplified",textAlign=TextAlign.Center,color=SalesMuted,fontWeight=FontWeight.SemiBold);Spacer(Modifier.height(28.dp));Text("Welcome Back!",style=MaterialTheme.typography.headlineLarge,fontWeight=FontWeight.Bold,color=SalesNavy,textAlign=TextAlign.Center);Text("Sign in to continue",color=SalesMuted);Spacer(Modifier.height(24.dp))
  OutlinedTextField(email,{email=it;onEdit()},Modifier.fillMaxWidth(),label={Text("Email")},singleLine=true,isError=attempted&&!validEmail,supportingText={if(attempted&&!validEmail)Text("Enter a valid email address")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email,imeAction=ImeAction.Next),keyboardActions=KeyboardActions(onNext={passwordFocus.requestFocus()}),enabled=!submitting)
  Spacer(Modifier.height(8.dp));OutlinedTextField(password,{password=it;onEdit()},Modifier.fillMaxWidth().focusRequester(passwordFocus),label={Text("Password")},singleLine=true,visualTransformation=if(visible)VisualTransformation.None else PasswordVisualTransformation(),trailingIcon={IconButton({visible=!visible}){Icon(if(visible)Icons.Default.VisibilityOff else Icons.Default.Visibility,if(visible)"Hide password" else "Show password")}},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password,imeAction=ImeAction.Done),keyboardActions=KeyboardActions(onDone={focus.clearFocus();attempted=true;if(validEmail&&password.isNotBlank()&&!submitting)onLogin(email,password,rememberMe)}),enabled=!submitting)
  Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){Checkbox(rememberMe,{rememberMe=it;onEdit()},enabled=!submitting);Text("Remember me")}
  message?.let{Spacer(Modifier.height(12.dp));MessageBanner(it,onEdit)};Spacer(Modifier.height(20.dp));Button({attempted=true;if(validEmail&&password.isNotBlank())onLogin(email,password,rememberMe)},Modifier.fillMaxWidth().heightIn(min=48.dp),enabled=!submitting&&password.isNotBlank()){if(submitting)CircularProgressIndicator(Modifier.size(22.dp),strokeWidth=2.dp)else Text("Sign in")};Spacer(Modifier.height(18.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.Center){Text("Don’t have an account?");TextButton(onSignUp){Text("Register Now")}}
 }}
 Text("© ${java.time.Year.now().value} SalesPunch360. All rights reserved.",modifier=Modifier.padding(top=20.dp),textAlign=TextAlign.Center,color=SalesMuted);TextButton({openPublicPage(context)}){Text("Explore SalesPunch360 & support")}
 }
}

@Composable fun NativeRegistrationScreen(onBack:()->Unit,onRegistered:()->Unit){
 var logo by remember{mutableStateOf<RegistrationLogo?>(null)};var logoUri by remember{mutableStateOf<android.net.Uri?>(null)};var passwordVisible by remember{mutableStateOf(false)};var confirmationVisible by remember{mutableStateOf(false)}
 var product by remember{mutableStateOf("SALESPUNCH360")};var company by remember{mutableStateOf("")};var name by remember{mutableStateOf("")};var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var confirm by remember{mutableStateOf("")};var accepted by remember{mutableStateOf(false)};var attempted by remember{mutableStateOf(false)};var submitting by remember{mutableStateOf(false)};var message by remember{mutableStateOf<String?>(null)}
 val context=LocalContext.current;val uriHandler=LocalUriHandler.current;val scope=rememberCoroutineScope();val client=remember(context){RegistrationClient(SecureSession(context.applicationContext))}
 val logoPicker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()){uri->if(uri!=null)scope.launch{try{val selected=withContext(Dispatchers.IO){val mime=context.contentResolver.getType(uri).orEmpty();require(mime in listOf("image/jpeg","image/png","image/webp"));val bytes=context.contentResolver.openInputStream(uri)?.use{input->val output=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192);var count:Int;while(input.read(buffer).also{count=it}!=-1){require(output.size()+count<=5*1024*1024);output.write(buffer,0,count)};output.toByteArray()}?:throw java.io.IOException("Image unavailable");require(bytes.isNotEmpty());RegistrationLogo(bytes,mime)};logo=selected;logoUri=uri;message=null}catch(_:Exception){message="Choose a JPEG, PNG or WebP image up to 5 MB."}}}
 val validCompany=company.trim().length>=2;val validName=name.trim().length>=2;val validEmail=Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches();val strongPassword=password.length>=12&&password.any(Char::isLowerCase)&&password.any(Char::isUpperCase)&&password.any(Char::isDigit);val passwordsMatch=password==confirm&&confirm.isNotEmpty();val fieldsEntered=company.isNotBlank()&&name.isNotBlank()&&email.isNotBlank()&&password.isNotBlank()&&confirm.isNotBlank()
 fun edit(){message=null}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().navigationBarsPadding().padding(24.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  TextButton(onClick={if(!submitting)onBack()},contentPadding=PaddingValues(0.dp),enabled=!submitting){Text("← Back to sign in")}
  Text("Create your workspace",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold);Text("Start your SalesPunch360 free trial.")
  Text("Choose product",style=MaterialTheme.typography.titleMedium)
  listOf("SALESPUNCH360" to "SalesPunch360","SALESPUNCH360_ACCOUNT" to "SalesPunch360 Account","SALESPUNCH360_PLUS" to "SalesPunch360 Plus").forEach{(value,label)->FilterChip(selected=product==value,onClick={product=value;edit()},label={Text(label)},enabled=!submitting)}
  OutlinedTextField(company,{company=it;edit()},Modifier.fillMaxWidth(),label={Text("Company name")},singleLine=true,enabled=!submitting,isError=attempted&&!validCompany,supportingText={if(attempted&&!validCompany)Text("Enter at least 2 characters")})
  Text("Company logo (optional)");logoUri?.let{AsyncImage(model=it,contentDescription="Company logo preview",modifier=Modifier.size(96.dp))};Row{TextButton({logoPicker.launch("image/*")},enabled=!submitting){Text("Choose logo")};if(logo!=null)TextButton({logo=null;logoUri=null},enabled=!submitting){Text("Remove logo")}};Text("JPEG, PNG or WebP · maximum 5 MB",style=MaterialTheme.typography.bodySmall)
  OutlinedTextField(name,{name=it;edit()},Modifier.fillMaxWidth(),label={Text("Full name")},singleLine=true,enabled=!submitting,isError=attempted&&!validName,supportingText={if(attempted&&!validName)Text("Enter at least 2 characters")})
  OutlinedTextField(email,{email=it;edit()},Modifier.fillMaxWidth(),label={Text("Email address")},singleLine=true,enabled=!submitting,isError=attempted&&!validEmail,supportingText={if(attempted&&!validEmail)Text("Enter a valid email address")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email))
  OutlinedTextField(password,{password=it;edit()},Modifier.fillMaxWidth(),label={Text("Password")},singleLine=true,enabled=!submitting,visualTransformation=if(passwordVisible)VisualTransformation.None else PasswordVisualTransformation(),trailingIcon={IconButton({passwordVisible=!passwordVisible}){Icon(if(passwordVisible)Icons.Default.VisibilityOff else Icons.Default.Visibility,if(passwordVisible)"Hide password" else "Show password")}},isError=attempted&&!strongPassword,supportingText={Text(if(attempted&&!strongPassword)"Use at least 12 characters with uppercase, lowercase and a number" else "At least 12 characters, with uppercase, lowercase and a number")})
  OutlinedTextField(confirm,{confirm=it;edit()},Modifier.fillMaxWidth(),label={Text("Confirm password")},singleLine=true,enabled=!submitting,visualTransformation=if(confirmationVisible)VisualTransformation.None else PasswordVisualTransformation(),trailingIcon={IconButton({confirmationVisible=!confirmationVisible}){Icon(if(confirmationVisible)Icons.Default.VisibilityOff else Icons.Default.Visibility,if(confirmationVisible)"Hide confirmed password" else "Show confirmed password")}},isError=attempted&&!passwordsMatch,supportingText={if(attempted&&!passwordsMatch)Text("Passwords do not match")})
  Row(verticalAlignment=Alignment.Top){
   Checkbox(accepted,{accepted=it;edit()},enabled=!submitting)
   Column(Modifier.padding(top=8.dp)){
    Text("I agree to the")
    Text("Terms of Service",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold,modifier=Modifier.clickable{runCatching{uriHandler.openUri("https://www.salespunch360.com/terms")}})
    Text("and acknowledge the")
    Text("Privacy Policy.",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold,modifier=Modifier.clickable{runCatching{uriHandler.openUri("https://www.salespunch360.com/privacy")}})
   }
  }
  message?.let{MessageBanner(it){message=null}}
  Button(onClick={
   attempted=true
   if(!validCompany||!validName||!validEmail||!strongPassword||!passwordsMatch||!accepted)return@Button
   scope.launch{
    submitting=true;message=null
    try{client.register(product,company,name,email,password,confirm,logo);onRegistered()}
    catch(error:Exception){message=registrationMessage(error)}
    finally{submitting=false}
   }
  },Modifier.fillMaxWidth().heightIn(min=48.dp),enabled=!submitting&&accepted&&fieldsEntered){if(submitting)CircularProgressIndicator(Modifier.size(22.dp),strokeWidth=2.dp)else Text("Start my free trial")}
 }
}

private fun registrationMessage(error:Exception)=when(error){
 is ApiException->when(error.code){
  "EMAIL_IN_USE"->"An account already exists with this email address."
  "LOGO_INVALID"->"Choose a valid JPEG, PNG or WebP image up to 5 MB."
  "INVALID_INPUT"->"Please review the registration details and try again."
  "LEGAL_CONSENT_REQUIRED"->"Agree to the Terms of Service and acknowledge the Privacy Policy to continue."
  "RATE_LIMITED"->"Too many registration attempts. Please wait and try again."
  else->"Unable to create your account. Please try again."
 }
 is IOException->"You're offline. Reconnect and try again."
 else->"Unable to create your account. Please try again."
}
