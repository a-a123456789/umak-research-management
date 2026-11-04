package ph.edu.umak.crm.cache

import android.content.Context
import androidx.room.*
import androidx.work.*
import org.json.JSONObject
import java.io.File
import java.io.ByteArrayOutputStream
import java.net.URL
import java.net.HttpURLConnection
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

@Entity(tableName = "public_content")
data class PublicItem(@PrimaryKey val id: String, val kind: String, val title: String, val text: String,
    val version: String, val syncedAt: Long, val templatePath: String?)
@Dao interface PublicDao {
    @Query("SELECT * FROM public_content ORDER BY id") fun list(): List<PublicItem>
    @Query("DELETE FROM public_content") fun clear()
    @Insert fun insert(rows: List<PublicItem>)
    @Transaction fun replace(rows: List<PublicItem>) { clear(); insert(rows) }
}
@Database(entities = [PublicItem::class], version = 1, exportSchema = false)
abstract class PublicDatabase : RoomDatabase() { abstract fun content(): PublicDao }

/** Public data only. No manuscripts, reviews, passwords or tokens enter Room. */
class PublicSync(context: Context, params: WorkerParameters) : Worker(context, params) {
    private fun download(url: URL, maximum: Int): ByteArray {
        require(url.protocol == "https")
        val connection = url.openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 10000; connection.readTimeout = 15000
        try {
            require(connection.responseCode == 200)
            require(connection.contentLengthLong <= maximum)
            return connection.inputStream.use { stream ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= maximum)
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
        } finally { connection.disconnect() }
    }
    override fun doWork(): Result {
        val base = inputData.getString("base_url") ?: return Result.failure()
        val database = Room.databaseBuilder(applicationContext, PublicDatabase::class.java, "crm-public.db").build()
        return try {
            val origin = URL(base)
            require(origin.protocol == "https" && origin.userInfo == null)
            val body = JSONObject(String(download(URL(origin, "/api/v1/public/content"), 1_000_000), Charsets.UTF_8))
            val version = body.getString("version"); require(version.length <= 100)
            val items = body.getJSONArray("items"); require(items.length() <= 100)
            val directory = File(applicationContext.filesDir, "crm-public-templates").apply { mkdirs() }
            val rows = mutableListOf<PublicItem>(); var totalBytes = 0
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val id = item.getString("id"); require(id.matches(Regex("[A-Za-z0-9_-]{1,64}")))
                val kind = item.getString("kind"); require(kind in setOf("directory", "requirements", "instructions", "template"))
                var path: String? = null
                if (kind == "template") {
                    val relative = item.getString("url")
                    require(relative.matches(Regex("/api/v1/public/templates/[A-Za-z0-9_.-]+")))
                    val url = URL(origin, relative)
                    require(url.host == origin.host && url.port == origin.port)
                    val expected = item.getString("sha256"); require(expected.matches(Regex("[a-f0-9]{64}")))
                    val bytes = download(url, 25_000_000)
                    totalBytes += bytes.size; require(totalBytes <= 100_000_000)
                    val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
                    require(hash == expected)
                    val target = File(directory, expected)
                    if (!target.exists()) {
                        val temporary = File.createTempFile("download-", ".tmp", directory)
                        try { temporary.writeBytes(bytes); require(temporary.renameTo(target)) } finally { temporary.delete() }
                    }
                    path = target.absolutePath
                }
                rows += PublicItem(id, kind, item.getString("title"), item.getString("text"), version, System.currentTimeMillis(), path)
            }
            require(rows.map { it.id }.toSet().size == rows.size)
            database.content().replace(rows) // Only publish after all templates pass validation.
            Result.success()
        } catch (_: Exception) { if (runAttemptCount < 3) Result.retry() else Result.failure() }
        finally { database.close() }
    }
    companion object {
        fun schedule(context: Context, baseUrl: String) {
            val request = PeriodicWorkRequestBuilder<PublicSync>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setInputData(workDataOf("base_url" to baseUrl)).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("crm-public-sync", ExistingPeriodicWorkPolicy.UPDATE, request)
        }
    }
}
