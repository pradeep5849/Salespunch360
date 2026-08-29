package com.salespunch360.mobile.data
import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow
@Entity(tableName="pending_locations") data class PendingLocation(@PrimaryKey val id:String,val latitude:Double,val longitude:Double,val accuracy:Double?,val capturedAt:String,val createdAt:Long=System.currentTimeMillis())
@Dao interface LocationDao{@Insert(onConflict=OnConflictStrategy.IGNORE)suspend fun insert(point:PendingLocation);@Query("SELECT * FROM pending_locations ORDER BY capturedAt LIMIT :limit")suspend fun batch(limit:Int=50):List<PendingLocation>;@Query("DELETE FROM pending_locations WHERE id=:id")suspend fun delete(id:String);@Query("DELETE FROM pending_locations WHERE id IN (SELECT id FROM pending_locations ORDER BY createdAt ASC LIMIT :count)")suspend fun deleteOldest(count:Int);@Query("SELECT COUNT(*) FROM pending_locations")fun count():Flow<Int>;@Query("SELECT COUNT(*) FROM pending_locations")suspend fun countNow():Int}
@Database(entities=[PendingLocation::class],version=1,exportSchema=false)abstract class AppDatabase:RoomDatabase(){abstract fun locations():LocationDao;companion object{fun create(context:Context)=Room.databaseBuilder(context,AppDatabase::class.java,"gps_queue.db").fallbackToDestructiveMigration().build()}}
class LocationQueue(private val dao:LocationDao){val count:Flow<Int> = dao.count();suspend fun enqueue(point:PendingLocation){dao.insert(point);val overflow=dao.countNow()-500;if(overflow>0)dao.deleteOldest(overflow)}}
