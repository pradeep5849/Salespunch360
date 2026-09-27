package com.salespunch360.mobile.data

import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName="pending_locations",indices=[Index("ownerUserId")])
data class PendingLocation(@PrimaryKey val id:String,val ownerUserId:String,val latitude:Double,val longitude:Double,val accuracy:Double?,val capturedAt:String,val createdAt:Long=System.currentTimeMillis())
@Entity(tableName="location_sync_status")
data class LocationSyncStatus(@PrimaryKey val ownerUserId:String,val lastSuccessAt:String?=null,val discardedCount:Int=0,val lastIssue:String?=null)

@Dao abstract class LocationDao {
 @Insert(onConflict=OnConflictStrategy.IGNORE) abstract suspend fun insert(point:PendingLocation)
 @Query("SELECT * FROM pending_locations WHERE ownerUserId=:ownerUserId ORDER BY capturedAt,id LIMIT :limit") abstract suspend fun batch(ownerUserId:String,limit:Int=50):List<PendingLocation>
 @Query("DELETE FROM pending_locations WHERE id=:id AND ownerUserId=:ownerUserId") abstract suspend fun delete(id:String,ownerUserId:String)
 @Query("DELETE FROM pending_locations WHERE id IN (SELECT id FROM pending_locations WHERE ownerUserId=:ownerUserId ORDER BY createdAt,id LIMIT :count)") abstract suspend fun deleteOldest(ownerUserId:String,count:Int)
 @Query("DELETE FROM pending_locations WHERE ownerUserId=:ownerUserId") abstract suspend fun clearOwner(ownerUserId:String)
 @Query("DELETE FROM pending_locations") abstract suspend fun clearAll()
 @Query("SELECT COUNT(*) FROM pending_locations WHERE ownerUserId=:ownerUserId") abstract fun count(ownerUserId:String):Flow<Int>
 @Query("SELECT COUNT(*) FROM pending_locations WHERE ownerUserId=:ownerUserId") abstract suspend fun countNow(ownerUserId:String):Int
 @Query("SELECT * FROM location_sync_status WHERE ownerUserId=:ownerUserId") abstract fun status(ownerUserId:String):Flow<LocationSyncStatus?>
 @Insert(onConflict=OnConflictStrategy.IGNORE) abstract suspend fun ensureStatus(status:LocationSyncStatus)
 @Query("UPDATE location_sync_status SET lastSuccessAt=:at WHERE ownerUserId=:owner") abstract suspend fun updateSuccess(owner:String,at:String)
 @Query("UPDATE location_sync_status SET discardedCount=discardedCount+:count,lastIssue=:reason WHERE ownerUserId=:owner") abstract suspend fun recordDiscard(owner:String,count:Int,reason:String)
 @Query("UPDATE location_sync_status SET lastIssue=:reason WHERE ownerUserId=:owner") abstract suspend fun setIssue(owner:String,reason:String?)
 @Query("DELETE FROM location_sync_status WHERE ownerUserId=:owner") abstract suspend fun clearStatus(owner:String)
 @Transaction open suspend fun acknowledge(point:PendingLocation,at:String){ensureStatus(LocationSyncStatus(point.ownerUserId));delete(point.id,point.ownerUserId);updateSuccess(point.ownerUserId,at)}
 @Transaction open suspend fun discard(point:PendingLocation,reason:String){ensureStatus(LocationSyncStatus(point.ownerUserId));delete(point.id,point.ownerUserId);recordDiscard(point.ownerUserId,1,reason)}
 @Transaction open suspend fun enqueue(point:PendingLocation){
  insert(point);ensureStatus(LocationSyncStatus(point.ownerUserId))
  val overflow=countNow(point.ownerUserId)-10000
  if(overflow>0){deleteOldest(point.ownerUserId,overflow);recordDiscard(point.ownerUserId,overflow,"QUEUE_LIMIT")}
 }
}
@Database(entities=[PendingLocation::class,LocationSyncStatus::class],version=3,exportSchema=true)
abstract class AppDatabase:RoomDatabase(){
 abstract fun locations():LocationDao
 companion object{
  val MIGRATION_1_2=object:Migration(1,2){override fun migrate(db:SupportSQLiteDatabase){
   // Legacy unowned points are quarantined; never upload them under a new login.
   db.execSQL("ALTER TABLE pending_locations ADD COLUMN ownerUserId TEXT NOT NULL DEFAULT ''")
   db.execSQL("CREATE INDEX IF NOT EXISTS index_pending_locations_ownerUserId ON pending_locations(ownerUserId)")
  }}
  val MIGRATION_2_3=object:Migration(2,3){override fun migrate(db:SupportSQLiteDatabase){
   db.execSQL("CREATE TABLE IF NOT EXISTS location_sync_status (ownerUserId TEXT NOT NULL PRIMARY KEY,lastSuccessAt TEXT,discardedCount INTEGER NOT NULL,lastIssue TEXT)")
  }}
  fun create(context:Context)=Room.databaseBuilder(context,AppDatabase::class.java,"gps_queue.db").addMigrations(MIGRATION_1_2,MIGRATION_2_3).build()
 }
}
class LocationQueue(private val dao:LocationDao){suspend fun enqueue(point:PendingLocation)=dao.enqueue(point)}
