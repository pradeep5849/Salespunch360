package com.salespunch360.mobile.account

import com.salespunch360.mobile.data.ApiException
import java.io.IOException

internal fun moneyMutationFeedback(error:Exception):String = when {
    error is IOException -> "Offline. No cash/bank change was confirmed. Your entries are retained; retry when online."
    error is ApiException && error.status==403 -> "You are not authorized for this cash/bank action. Your entries are retained."
    error is ApiException && error.status==401 -> "Your session expired. Sign in again before retrying this cash/bank action."
    error is ApiException && !error.serverMessage.isNullOrBlank() -> error.serverMessage
    error is ApiException && error.code=="INVALID_INPUT" -> "Check the entered details and try again. Your entries are retained."
    else -> "Cash/bank action rejected by server. Your entries are retained."
}
