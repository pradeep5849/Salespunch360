package com.salespunch360.mobile.ui

import android.util.Patterns
import androidx.compose.foundation.Image
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.R

@Composable fun LoginScreen(message:String?,submitting:Boolean,onEdit:()->Unit,onLogin:(String,String)->Unit){
 var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var visible by remember{mutableStateOf(false)};var attempted by remember{mutableStateOf(false)};val passwordFocus=remember{FocusRequester()};val focus=LocalFocusManager.current;val validEmail=Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
 val context=LocalContext.current
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().navigationBarsPadding().padding(horizontal=28.dp,vertical=40.dp),verticalArrangement=Arrangement.Center){
  Image(painter=painterResource(R.drawable.salespunch360_logo),contentDescription="SalesPunch360 — Track. Punch. Perform.",modifier=Modifier.fillMaxWidth().heightIn(max=150.dp),contentScale=ContentScale.Fit);Spacer(Modifier.height(32.dp));Text("Welcome back",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold);Text("Sign in to your company workspace.");Spacer(Modifier.height(24.dp))
  OutlinedTextField(email,{email=it;onEdit()},Modifier.fillMaxWidth(),label={Text("Email")},singleLine=true,isError=attempted&&!validEmail,supportingText={if(attempted&&!validEmail)Text("Enter a valid email address")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email,imeAction=ImeAction.Next),keyboardActions=KeyboardActions(onNext={passwordFocus.requestFocus()}),enabled=!submitting)
  Spacer(Modifier.height(8.dp));OutlinedTextField(password,{password=it;onEdit()},Modifier.fillMaxWidth().focusRequester(passwordFocus),label={Text("Password")},singleLine=true,visualTransformation=if(visible)VisualTransformation.None else PasswordVisualTransformation(),trailingIcon={IconButton({visible=!visible}){Icon(if(visible)Icons.Default.VisibilityOff else Icons.Default.Visibility,if(visible)"Hide password" else "Show password")}},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password,imeAction=ImeAction.Done),keyboardActions=KeyboardActions(onDone={focus.clearFocus();attempted=true;if(validEmail&&password.isNotBlank()&&!submitting)onLogin(email,password)}),enabled=!submitting)
  message?.let{Spacer(Modifier.height(12.dp));MessageBanner(it,onEdit)};Spacer(Modifier.height(20.dp));Button({attempted=true;if(validEmail&&password.isNotBlank())onLogin(email,password)},Modifier.fillMaxWidth().heightIn(min=48.dp),enabled=!submitting&&password.isNotBlank()){if(submitting)CircularProgressIndicator(Modifier.size(22.dp),strokeWidth=2.dp)else Text("Sign in")};Spacer(Modifier.height(18.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.Center){Text("New to SalesPunch360?");TextButton({context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("https://www.salespunch360.com/register")))}){Text("Sign up")}}
 }
}
