package com.example

import com.example.data.repository.UserClubAssociation
import com.example.data.repository.sanitizeEmailKey
import com.example.ui.screens.calculateWinningScore
import org.junit.Assert.*
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun testWinningScoreAutoPopulation_15Points() {
        assertEquals(15, calculateWinningScore(10, 15))
        assertEquals(18, calculateWinningScore(16, 15))
        assertEquals(20, calculateWinningScore(19, 15))
    }

    @Test
    fun testWinningScoreAutoPopulation_21Points() {
        assertEquals(21, calculateWinningScore(10, 21))
        assertEquals(21, calculateWinningScore(19, 21))
        assertEquals(30, calculateWinningScore(29, 21))
    }

    @Test
    fun testSanitizeEmailKey() {
        assertEquals("ashish_verma_uk_at_gmail_com", sanitizeEmailKey("ashish.verma.uk@gmail.com"))
        assertEquals("club_manager_at_example_org", sanitizeEmailKey("club.manager@example.org"))
        assertEquals("user_tag_at_domain_com", sanitizeEmailKey("user+tag@domain.com"))
    }

    @Test
    fun testUserClubAssociation() {
        val assoc = UserClubAssociation(
            email = "manager@example.com",
            clubId = "club_abc123",
            clubName = "Downtown Badminton",
            role = "SESSION_MANAGER",
            managerId = 42,
            managerName = "John Doe",
            venue = "Court 1-4"
        )
        assertEquals("manager@example.com", assoc.email)
        assertEquals("club_abc123", assoc.clubId)
        assertEquals("Downtown Badminton", assoc.clubName)
        assertEquals("SESSION_MANAGER", assoc.role)
        assertEquals(42, assoc.managerId)
        assertEquals("John Doe", assoc.managerName)
    }
}
