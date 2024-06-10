package com.javamaster.service;


import com.javamaster.model.*;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.regions.Region;
import com.javamaster.exception.InvalidGameException;
import com.javamaster.exception.InvalidParamException;
import com.javamaster.exception.NotFoundException;
import com.javamaster.storage.GameStorage;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import java.util.*;

import static com.javamaster.model.GameStatus.*;

@Service
@AllArgsConstructor
public class GameService {


    private DynamoDbClient getClient() {
        Region region = Region.US_EAST_1;
        return DynamoDbClient.builder()
                .region(region)
                .build();
    }

    public Game createGame(Player player) {
        Game game = new Game();
        game.setBoard(new int[3][3]);
        game.setGameId(UUID.randomUUID().toString());
        game.setPlayer1(player);
        game.setStatus(NEW);
        GameStorage.getInstance().setGame(game);


        return game;
    }

    public Game connectToGame(Player player2, String gameId) throws InvalidParamException, InvalidGameException {
        if (!GameStorage.getInstance().getGames().containsKey(gameId)) {
            throw new InvalidParamException("Game with provided id doesn't exist");
        }
        Game game = GameStorage.getInstance().getGames().get(gameId);

        if (game.getPlayer2() != null) {
            throw new InvalidGameException("Game is not valid anymore");
        }

        game.setPlayer2(player2);
        game.setStatus(IN_PROGRESS);
        GameStorage.getInstance().setGame(game);
        return game;
    }

    public Game connectToRandomGame(Player player2) throws NotFoundException {
        Game game = GameStorage.getInstance().getGames().values().stream()
                .filter(it -> it.getStatus().equals(NEW))
                .findFirst().orElseThrow(() -> new NotFoundException("Game not found"));
        game.setPlayer2(player2);
        game.setStatus(IN_PROGRESS);
        GameStorage.getInstance().setGame(game);
        return game;
    }

    public Game gamePlay(GamePlay gamePlay) throws NotFoundException, InvalidGameException {
        if (!GameStorage.getInstance().getGames().containsKey(gamePlay.getGameId())) {
            throw new NotFoundException("Game not found");
        }

        Game game = GameStorage.getInstance().getGames().get(gamePlay.getGameId());
        if (game.getStatus().equals(FINISHED)) {
            throw new InvalidGameException("Game is already finished");
        }

        int[][] board = game.getBoard();
        board[gamePlay.getCoordinateX()][gamePlay.getCoordinateY()] = gamePlay.getType().getValue();

        Boolean xWinner = checkWinner(game.getBoard(), TicToe.X);
        Boolean oWinner = checkWinner(game.getBoard(), TicToe.O);

        if (xWinner) {
            game.setWinner(TicToe.X);
        } else if (oWinner) {
            game.setWinner(TicToe.O);
        }

        if (xWinner || oWinner) {
            DynamoDbEnhancedClient enhancedClient = DynamoDbEnhancedClient.builder()
                    .dynamoDbClient(getClient())
                    .build();
            if (xWinner)
                putRecord(enhancedClient, game, game.getPlayer1().getLogin());
            else
                putRecord(enhancedClient, game, game.getPlayer2().getLogin());
        }



        game.setCurrentTurn(Objects.equals(game.getCurrentTurn(), "O") ? "X" : "O");

        GameStorage.getInstance().setGame(game);
        return game;
    }

    public void putRecord(DynamoDbEnhancedClient enhancedClient, Game item, String winner) {
        try{
            DynamoDbTable<FinishedGame> gamesTable = enhancedClient.table("games", TableSchema.fromBean(FinishedGame.class));
            FinishedGame record = new FinishedGame();
            record.setGameId(item.getGameId());
            record.setPlayer1(item.getPlayer1().getLogin());
            record.setPlayer2(item.getPlayer2().getLogin());
            record.setWinner(winner);
            gamesTable.putItem(record);

        }  catch (DynamoDbException e) {
            System.err.println(e.getMessage());
            System.exit(1);
        }

    }

    public List<FinishedGame> getAllGames() {
        DynamoDbEnhancedClient enhancedClient = DynamoDbEnhancedClient.builder()
                .dynamoDbClient(getClient())
                .build();

        try{
            DynamoDbTable<FinishedGame> table = enhancedClient.table("games", TableSchema.fromBean(FinishedGame.class));
            Iterator<FinishedGame> results = table.scan().items().iterator();
            FinishedGame gameItem ;
            ArrayList<FinishedGame> itemList = new ArrayList<>();

            while (results.hasNext()) {
                gameItem = new FinishedGame();
                FinishedGame game = results.next();
                gameItem.setGameId(game.getGameId());
                gameItem.setPlayer1(game.getPlayer1());
                gameItem.setPlayer2(game.getPlayer2());
                gameItem.setWinner(game.getWinner());

                // Push the workItem to the list.
                itemList.add(gameItem);
            }
            return itemList;

        } catch (DynamoDbException e) {
            System.err.println(e.getMessage());
            System.exit(1);
        }
        return null;
    }

    private Boolean checkWinner(int[][] board, TicToe ticToe) {
        int[] boardArray = new int[9];
        int counterIndex = 0;
        for (int i = 0; i < board.length; i++) {
            for (int j = 0; j < board[i].length; j++) {
                boardArray[counterIndex] = board[i][j];
                counterIndex++;
            }
        }

        int[][] winCombinations = {{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, {0, 4, 8}, {2, 4, 6}};
        for (int i = 0; i < winCombinations.length; i++) {
            int counter = 0;
            for (int j = 0; j < winCombinations[i].length; j++) {
                if (boardArray[winCombinations[i][j]] == ticToe.getValue()) {
                    counter++;
                    if (counter == 3) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
