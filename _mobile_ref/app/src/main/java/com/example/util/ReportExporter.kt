package com.example.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.example.data.database.CourtEntity
import com.example.data.database.MatchEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionEntity
import com.example.data.repository.PlayerStats
import com.example.data.repository.SessionStats
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object ReportExporter {

    private val dateFormatter = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault())
    private val fileDateFormatter = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault())

    /**
     * Generates a CSV report and opens the Android share/save dialog.
     */
    fun shareSessionReportCsv(
        context: Context,
        session: SessionEntity,
        courts: List<CourtEntity>,
        matches: List<MatchEntity>,
        players: List<PlayerEntity>,
        sessionStats: SessionStats?,
        playerStatsList: List<PlayerStats>
    ) {
        val sanitizedSessionName = session.name.replace("\\s+".toRegex(), "_")
        val timestamp = fileDateFormatter.format(Date())
        val fileName = "Badminton_${sanitizedSessionName}_Report_$timestamp.csv"
        val file = File(context.cacheDir, fileName)

        try {
            FileOutputStream(file).use { outputStream ->
                val writer = outputStream.bufferedWriter()

                // 1. Session Overview
                writer.write("BADMINTON SESSION REPORT\n")
                writer.write("Session Name,${session.name}\n")
                writer.write("Session Type,${session.type}\n")
                writer.write("Status,${session.status}\n")
                writer.write("Start Time,${session.startTime?.let { dateFormatter.format(Date(it)) } ?: "N/A"}\n")
                writer.write("End Time,${session.endTime?.let { dateFormatter.format(Date(it)) } ?: "N/A"}\n")

                val durationMs = sessionStats?.durationMs ?: 0L
                val hours = durationMs / 3600000
                val minutes = (durationMs % 3600000) / 60000
                writer.write("Duration,${hours}h ${minutes}m\n")
                writer.write("Total Games Played,${sessionStats?.totalGamesPlayed ?: 0}\n")
                writer.write("\n")

                // 2. Standings / Leaderboard
                writer.write("SESSION STANDINGS (LEADERBOARD)\n")
                writer.write("Rank,Player Name,Gender,Games Played,Games Won,Games Lost,Win Rate (%),Points Scored,Points Conceded,Avg Points/Game,Max Winning Streak,Max Losing Streak\n")
                
                val sortedPlayers = playerStatsList.sortedWith(
                    compareByDescending<PlayerStats> { it.gamesWon }
                        .thenBy { it.gamesLost }
                        .thenByDescending { it.totalPointsScored }
                )

                sortedPlayers.forEachIndexed { index, stats ->
                    writer.write(
                        "${index + 1}," +
                        "\"${stats.name}\"," +
                        "${stats.gender}," +
                        "${stats.gamesPlayed}," +
                        "${stats.gamesWon}," +
                        "${stats.gamesLost}," +
                        "${String.format("%.1f", stats.winPercentage)}%," +
                        "${stats.totalPointsScored}," +
                        "${stats.totalPointsConceded}," +
                        "${String.format("%.1f", stats.averagePointsPerGame)}," +
                        "${stats.consecutiveWins}," +
                        "${stats.consecutiveLosses}\n"
                    )
                }
                writer.write("\n")

                // 3. Court Utilization
                writer.write("COURT UTILIZATION\n")
                writer.write("Court Name,Games Played,Utilization (%)\n")
                courts.forEach { court ->
                    val gamesCount = sessionStats?.gamesPerCourt?.get(court.id) ?: 0
                    val utilPercent = sessionStats?.courtUtilization?.get(court.id) ?: 0f
                    writer.write("\"${court.name}\",$gamesCount,${String.format("%.1f", utilPercent)}%\n")
                }
                writer.write("\n")

                // 4. Match Records
                writer.write("MATCH RECORDS\n")
                writer.write("Match #,Court,Team A Players,Team B Players,Team A Score,Team B Score,Winner\n")
                
                val completedMatches = matches.filter { it.endTime != null }.sortedBy { it.matchNumber }
                completedMatches.forEach { match ->
                    val courtName = courts.find { it.id == match.courtId }?.name ?: "Unknown Court"
                    val p1A = players.find { it.id == match.teamAPlayer1Id }?.name ?: ""
                    val p2A = match.teamAPlayer2Id?.let { players.find { p -> p.id == it }?.name }
                    val teamAPlayers = if (p2A != null) "$p1A & $p2A" else p1A

                    val p1B = players.find { it.id == match.teamBPlayer1Id }?.name ?: ""
                    val p2B = match.teamBPlayer2Id?.let { players.find { p -> p.id == it }?.name }
                    val teamBPlayers = if (p2B != null) "$p1B & $p2B" else p1B

                    val scoreA = match.teamAScore ?: 0
                    val scoreB = match.teamBScore ?: 0
                    val winner = when (match.winnerTeam) {
                        "A" -> "Team A"
                        "B" -> "Team B"
                        else -> "Tie"
                    }

                    writer.write(
                        "${match.matchNumber}," +
                        "\"$courtName\"," +
                        "\"$teamAPlayers\"," +
                        "\"$teamBPlayers\"," +
                        "$scoreA," +
                        "$scoreB," +
                        "$winner\n"
                    )
                }

                writer.flush()
            }

            shareFile(context, file, "text/csv", "Share Badminton Session CSV Report")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Generates a beautifully formatted PDF report and opens the Android share/save dialog.
     */
    fun shareSessionReportPdf(
        context: Context,
        session: SessionEntity,
        courts: List<CourtEntity>,
        matches: List<MatchEntity>,
        players: List<PlayerEntity>,
        sessionStats: SessionStats?,
        playerStatsList: List<PlayerStats>,
        clubName: String
    ) {
        val sanitizedSessionName = session.name.replace("\\s+".toRegex(), "_")
        val timestamp = fileDateFormatter.format(Date())
        val fileName = "Badminton_${sanitizedSessionName}_Report_$timestamp.pdf"
        val file = File(context.cacheDir, fileName)

        try {
            val pdfDocument = PdfDocument()

            // Page dimensions (A4 size: 595 x 842 points)
            val pageWidth = 595
            val pageHeight = 842
            val margin = 40f
            val printableWidth = pageWidth - (margin * 2)

            var pageNumber = 1
            var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            var page = pdfDocument.startPage(pageInfo)
            var canvas = page.canvas

            // Paints setup
            val titlePaint = Paint().apply {
                color = Color.rgb(2, 132, 199) // Sky 600
                textSize = 22f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val subtitlePaint = Paint().apply {
                color = Color.rgb(71, 85, 105) // Slate 600
                textSize = 10f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                isAntiAlias = true
            }

            val headerPaint = Paint().apply {
                color = Color.rgb(15, 23, 42) // Slate 900
                textSize = 14f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val subheaderPaint = Paint().apply {
                color = Color.rgb(15, 23, 42) // Slate 900
                textSize = 11f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val bodyPaint = Paint().apply {
                color = Color.rgb(51, 65, 85) // Slate 700
                textSize = 9f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                isAntiAlias = true
            }

            val bodyBoldPaint = Paint().apply {
                color = Color.rgb(15, 23, 42) // Slate 900
                textSize = 9f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val linePaint = Paint().apply {
                color = Color.rgb(226, 232, 240) // Slate 200
                strokeWidth = 1f
                style = Paint.Style.STROKE
            }

            val tableHeaderBgPaint = Paint().apply {
                color = Color.rgb(241, 245, 249) // Slate 100
                style = Paint.Style.FILL
            }

            var currentY = margin + 20f

            fun drawHeaderAndFooter(canvas: Canvas, pageNum: Int) {
                // Header line
                val topHeaderPaint = Paint().apply {
                    color = Color.rgb(148, 163, 184) // Slate 400
                    textSize = 8f
                    typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.ITALIC)
                }
                canvas.drawText(clubName.uppercase(), margin, 30f, topHeaderPaint)
                canvas.drawText("SESSION REPORT", pageWidth / 2f - 30f, 30f, topHeaderPaint)
                
                // Footer line
                val footerY = pageHeight - 25f
                canvas.drawLine(margin, footerY - 10f, pageWidth - margin, footerY - 10f, linePaint)
                
                val footerPaint = Paint().apply {
                    color = Color.rgb(148, 163, 184)
                    textSize = 8f
                }
                canvas.drawText("Generated on ${dateFormatter.format(Date())}", margin, footerY, footerPaint)
                canvas.drawText("Page $pageNum", pageWidth - margin - 30f, footerY, footerPaint)
            }

            // Draw header on the first page
            drawHeaderAndFooter(canvas, pageNumber)

            // Title
            canvas.drawText(session.name, margin, currentY, titlePaint)
            currentY += 15f
            canvas.drawText("Badminton Club Session Report • Type: ${session.type}", margin, currentY, subtitlePaint)
            currentY += 25f

            // 1. Overview Section
            canvas.drawText("SESSION OVERVIEW", margin, currentY, subheaderPaint)
            currentY += 8f
            canvas.drawLine(margin, currentY, pageWidth - margin, currentY, linePaint)
            currentY += 15f

            // Render Overview Details in a Grid-like format
            val colWidth = printableWidth / 3f
            
            // Row 1
            canvas.drawText("Date: ${session.startTime?.let { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(it)) } ?: "N/A"}", margin, currentY, bodyPaint)
            val durationMs = sessionStats?.durationMs ?: 0L
            val hours = durationMs / 3600000
            val minutes = (durationMs % 3600000) / 60000
            canvas.drawText("Duration: ${hours}h ${minutes}m", margin + colWidth, currentY, bodyPaint)
            canvas.drawText("Total Games: ${sessionStats?.totalGamesPlayed ?: 0}", margin + (colWidth * 2), currentY, bodyPaint)
            
            currentY += 15f
            
            // Row 2
            canvas.drawText("Start: ${session.startTime?.let { SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(it)) } ?: "N/A"}", margin, currentY, bodyPaint)
            canvas.drawText("End: ${session.endTime?.let { SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(it)) } ?: "N/A"}", margin + colWidth, currentY, bodyPaint)
            canvas.drawText("Active Players: ${playerStatsList.count { it.gamesPlayed > 0 }}", margin + (colWidth * 2), currentY, bodyPaint)

            currentY += 30f

            fun checkNewPage(requiredHeight: Float) {
                if (currentY + requiredHeight > pageHeight - margin - 40f) {
                    pdfDocument.finishPage(page)
                    pageNumber++
                    pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                    page = pdfDocument.startPage(pageInfo)
                    canvas = page.canvas
                    drawHeaderAndFooter(canvas, pageNumber)
                    currentY = margin + 20f
                }
            }

            // 2. Leaderboard Section
            checkNewPage(120f)
            canvas.drawText("STANDINGS & STATISTICS", margin, currentY, subheaderPaint)
            currentY += 8f
            canvas.drawLine(margin, currentY, pageWidth - margin, currentY, linePaint)
            currentY += 12f

            // Table headers for Leaderboard
            val lCols = listOf(
                Triple("Rank", 35f, Paint.Align.LEFT),
                Triple("Player Name", 140f, Paint.Align.LEFT),
                Triple("Played", 45f, Paint.Align.CENTER),
                Triple("Won", 40f, Paint.Align.CENTER),
                Triple("Lost", 40f, Paint.Align.CENTER),
                Triple("Win %", 50f, Paint.Align.CENTER),
                Triple("Points +/-", 65f, Paint.Align.CENTER),
                Triple("Avg Pts", 50f, Paint.Align.CENTER)
            )

            // Draw header background
            canvas.drawRect(margin, currentY - 10f, pageWidth - margin, currentY + 12f, tableHeaderBgPaint)
            
            // Draw header text
            var xOffset = margin + 5f
            lCols.forEach { (title, width, align) ->
                val alignPaint = Paint(bodyBoldPaint).apply { textAlign = align }
                val drawX = when (align) {
                    Paint.Align.LEFT -> xOffset
                    Paint.Align.CENTER -> xOffset + (width / 2f)
                    Paint.Align.RIGHT -> xOffset + width
                }
                canvas.drawText(title, drawX, currentY + 4f, alignPaint)
                xOffset += width
            }
            
            currentY += 12f
            canvas.drawLine(margin, currentY, pageWidth - margin, currentY, linePaint)
            currentY += 12f

            val sortedPlayers = playerStatsList.sortedWith(
                compareByDescending<PlayerStats> { it.gamesWon }
                    .thenBy { it.gamesLost }
                    .thenByDescending { it.totalPointsScored }
            )

            sortedPlayers.forEachIndexed { idx, stats ->
                checkNewPage(20f)
                
                // Alternating light row backgrounds
                if (idx % 2 == 1) {
                    canvas.drawRect(margin, currentY - 10f, pageWidth - margin, currentY + 8f, tableHeaderBgPaint)
                }

                xOffset = margin + 5f
                lCols.forEach { (colName, width, align) ->
                    val p = if (colName == "Player Name" || colName == "Rank") bodyBoldPaint else bodyPaint
                    val alignPaint = Paint(p).apply { textAlign = align }
                    val drawX = when (align) {
                        Paint.Align.LEFT -> xOffset
                        Paint.Align.CENTER -> xOffset + (width / 2f)
                        Paint.Align.RIGHT -> xOffset + width
                    }

                    val valueStr = when (colName) {
                        "Rank" -> "#${idx + 1}"
                        "Player Name" -> stats.name
                        "Played" -> stats.gamesPlayed.toString()
                        "Won" -> stats.gamesWon.toString()
                        "Lost" -> stats.gamesLost.toString()
                        "Win %" -> "${String.format("%.1f", stats.winPercentage)}%"
                        "Points +/-" -> "${stats.totalPointsScored}:${stats.totalPointsConceded}"
                        "Avg Pts" -> String.format("%.1f", stats.averagePointsPerGame)
                        else -> ""
                    }

                    canvas.drawText(valueStr, drawX, currentY, alignPaint)
                    xOffset += width
                }
                currentY += 18f
            }

            // 3. Match History Section
            currentY += 15f
            checkNewPage(100f)
            canvas.drawText("MATCH RECORDS", margin, currentY, subheaderPaint)
            currentY += 8f
            canvas.drawLine(margin, currentY, pageWidth - margin, currentY, linePaint)
            currentY += 12f

            // Table headers for Matches
            val mCols = listOf(
                Triple("Match #", 50f, Paint.Align.LEFT),
                Triple("Court", 85f, Paint.Align.LEFT),
                Triple("Team A", 145f, Paint.Align.LEFT),
                Triple("Team B", 145f, Paint.Align.LEFT),
                Triple("Score", 50f, Paint.Align.CENTER),
                Triple("Winner", 40f, Paint.Align.CENTER)
            )

            // Draw header background
            canvas.drawRect(margin, currentY - 10f, pageWidth - margin, currentY + 12f, tableHeaderBgPaint)
            
            // Draw header text
            xOffset = margin + 5f
            mCols.forEach { (title, width, align) ->
                val alignPaint = Paint(bodyBoldPaint).apply { textAlign = align }
                val drawX = when (align) {
                    Paint.Align.LEFT -> xOffset
                    Paint.Align.CENTER -> xOffset + (width / 2f)
                    Paint.Align.RIGHT -> xOffset + width
                }
                canvas.drawText(title, drawX, currentY + 4f, alignPaint)
                xOffset += width
            }
            
            currentY += 12f
            canvas.drawLine(margin, currentY, pageWidth - margin, currentY, linePaint)
            currentY += 12f

            val completedMatches = matches.filter { it.endTime != null }.sortedBy { it.matchNumber }
            completedMatches.forEachIndexed { idx, match ->
                checkNewPage(24f)

                // Alternating background
                if (idx % 2 == 1) {
                    canvas.drawRect(margin, currentY - 10f, pageWidth - margin, currentY + 10f, tableHeaderBgPaint)
                }

                val courtName = courts.find { it.id == match.courtId }?.name ?: "Court"
                val p1A = players.find { it.id == match.teamAPlayer1Id }?.name ?: ""
                val p2A = match.teamAPlayer2Id?.let { players.find { p -> p.id == it }?.name }
                val teamAPlayers = if (p2A != null) "$p1A / $p2A" else p1A

                val p1B = players.find { it.id == match.teamBPlayer1Id }?.name ?: ""
                val p2B = match.teamBPlayer2Id?.let { players.find { p -> p.id == it }?.name }
                val teamBPlayers = if (p2B != null) "$p1B / $p2B" else p1B

                val scoreA = match.teamAScore ?: 0
                val scoreB = match.teamBScore ?: 0
                val winner = match.winnerTeam ?: "-"

                xOffset = margin + 5f
                mCols.forEach { (colName, width, align) ->
                    val isBold = colName == "Match #" || (colName == "Team A" && winner == "A") || (colName == "Team B" && winner == "B")
                    val paint = if (isBold) bodyBoldPaint else bodyPaint
                    val alignPaint = Paint(paint).apply { textAlign = align }
                    
                    val drawX = when (align) {
                        Paint.Align.LEFT -> xOffset
                        Paint.Align.CENTER -> xOffset + (width / 2f)
                        Paint.Align.RIGHT -> xOffset + width
                    }

                    val valueStr = when (colName) {
                        "Match #" -> "Match ${match.matchNumber}"
                        "Court" -> courtName
                        "Team A" -> teamAPlayers
                        "Team B" -> teamBPlayers
                        "Score" -> "$scoreA - $scoreB"
                        "Winner" -> if (winner == "A") "Team A" else if (winner == "B") "Team B" else "Tie"
                        else -> ""
                    }

                    canvas.drawText(valueStr, drawX, currentY, alignPaint)
                    xOffset += width
                }
                currentY += 20f
            }

            pdfDocument.finishPage(page)

            // Save PDF
            FileOutputStream(file).use { out ->
                pdfDocument.writeTo(out)
            }
            pdfDocument.close()

            shareFile(context, file, "application/pdf", "Share Badminton Session PDF Report")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun shareFile(context: Context, file: File, mimeType: String, chooserTitle: String) {
        val uri = FileProvider.getUriForFile(context, "com.example.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, chooserTitle))
    }
}
