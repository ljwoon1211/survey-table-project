Attribute VB_Name = "SyncFilters"
Option Explicit

Public isSyncing As Boolean

' ===== 설정 읽기 =====
Private Function GetConfig(key As String, defaultVal As String) As String
    On Error GoTo UseDefault
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("_설정")
    Dim cell As Range
    For Each cell In ws.Range("A1:A100")
        If Len(cell.Value) = 0 Then Exit For
        If CStr(cell.Value) = key Then
            GetConfig = CStr(cell.Offset(0, 1).Value)
            Exit Function
        End If
    Next cell
UseDefault:
    GetConfig = defaultVal
End Function

Private Function IsExcludedSheet(ws As Worksheet) As Boolean
    Dim excludeList As String
    excludeList = "," & GetConfig("EXCLUDE_SHEETS", "_설정") & ","
    IsExcludedSheet = (InStr(excludeList, "," & ws.Name & ",") > 0)
End Function

' ===== ID 컬럼 헤더 탐색 =====
Private Function FindIdHeader(ws As Worksheet) As Range
    Dim idName As String
    idName = LCase(Trim(GetConfig("ID_HEADER", "response_id")))

    Dim maxRow As Long, maxCol As Long
    maxRow = CLng(GetConfig("HEADER_SEARCH_ROWS", "5"))
    maxCol = CLng(GetConfig("HEADER_SEARCH_COLS", "10"))

    Dim r As Long, c As Long
    For r = 1 To maxRow
        For c = 1 To maxCol
            If LCase(Trim(CStr(ws.Cells(r, c).Value))) = idName Then
                Set FindIdHeader = ws.Cells(r, c)
                Exit Function
            End If
        Next c
    Next r

    Set FindIdHeader = Nothing
End Function

' ===== 메인 동기화 =====
Public Sub SyncFiltersFromSheet(sourceSheet As Object)
    If isSyncing Then Exit Sub
    If sourceSheet Is Nothing Then Exit Sub
    If Not TypeOf sourceSheet Is Worksheet Then Exit Sub

    Dim src As Worksheet
    Set src = sourceSheet

    If IsExcludedSheet(src) Then Exit Sub
    If src.AutoFilterMode = False Then Exit Sub
    If src.AutoFilter Is Nothing Then Exit Sub

    Dim filterRange As Range
    Set filterRange = src.AutoFilter.Range
    If filterRange Is Nothing Then Exit Sub

    Dim idHeader As Range
    Set idHeader = FindIdHeader(src)
    If idHeader Is Nothing Then Exit Sub

    Dim idCol As Long
    idCol = idHeader.Column

    Dim firstDataRow As Long, lastDataRow As Long
    firstDataRow = filterRange.Row + 1
    lastDataRow = filterRange.Row + filterRange.Rows.Count - 1
    If idHeader.Row >= filterRange.Row Then firstDataRow = idHeader.Row + 1

    Dim idName As String
    idName = LCase(Trim(CStr(idHeader.Value)))

    Dim visRange As Range
    On Error Resume Next
    Set visRange = src.Range( _
        src.Cells(firstDataRow, idCol), _
        src.Cells(lastDataRow, idCol) _
    ).SpecialCells(xlCellTypeVisible)
    On Error GoTo 0
    If visRange Is Nothing Then Exit Sub

    Dim visibleIds As Collection
    Set visibleIds = New Collection

    Dim vcell As Range
    For Each vcell In visRange
        If Len(CStr(vcell.Value)) > 0 Then
            Dim idStr As String
            idStr = CStr(vcell.Value)
            If LCase(Trim(idStr)) <> idName Then
                On Error Resume Next
                visibleIds.Add idStr, idStr
                On Error GoTo 0
            End If
        End If
    Next vcell

    If visibleIds.Count = 0 Then Exit Sub

    Dim idArr() As String, idx As Long
    ReDim idArr(0 To visibleIds.Count - 1)
    idx = 0
    Dim item As Variant
    For Each item In visibleIds
        idArr(idx) = CStr(item)
        idx = idx + 1
    Next item

    isSyncing = True
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    On Error GoTo Cleanup

    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If ws.Name <> src.Name Then
            ApplyIdFilter ws, idArr
        End If
    Next ws

Cleanup:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    isSyncing = False
End Sub

' ===== 타겟 시트에 IN 필터 적용 =====
Private Sub ApplyIdFilter(ws As Worksheet, idArr() As String)
    On Error Resume Next

    If IsExcludedSheet(ws) Then Exit Sub
    If ws.AutoFilterMode = False Then Exit Sub
    If ws.AutoFilter Is Nothing Then Exit Sub

    Dim idHeader As Range
    Set idHeader = FindIdHeader(ws)
    If idHeader Is Nothing Then Exit Sub

    Dim fieldIdx As Long
    fieldIdx = idHeader.Column - ws.AutoFilter.Range.Column + 1
    If fieldIdx < 1 Then Exit Sub

    ws.AutoFilter.Range.AutoFilter Field:=fieldIdx
    ws.AutoFilter.Range.AutoFilter _
        Field:=fieldIdx, _
        Criteria1:=idArr, _
        Operator:=xlFilterValues
End Sub

' ===== 전체 필터 해제 =====
Public Sub ClearAllFilters()
Attribute ClearAllFilters.VB_ProcData.VB_Invoke_Func = "Q\n14"
    Dim ws As Worksheet
    isSyncing = True
    Application.EnableEvents = False
    For Each ws In ThisWorkbook.Worksheets
        If Not IsExcludedSheet(ws) Then
            If ws.AutoFilterMode Then
                If ws.AutoFilter.FilterMode Then
                    ws.AutoFilter.ShowAllData
                End If
            End If
        End If
    Next ws
    Application.EnableEvents = True
    isSyncing = False
End Sub

